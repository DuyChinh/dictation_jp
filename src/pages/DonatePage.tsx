import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { AppShell } from "../shared/ui/AppShell";
import { Icon, type IconName } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../shared/i18n/translations";
import { useAuth } from "../features/auth/AuthContext";
import { DONATE, SUPPORT_VIDEO } from "../config/donate";
import { buildVietQr } from "../features/donate/vietQr";
import { claimSupportVoucher, fetchMyVouchers, supportVoucher, type Voucher } from "../shared/api/vouchers";

const AMOUNT_LABELS: TranslationKey[] = ["donate.tier1", "donate.tier2", "donate.tier3", "donate.tier4", "donate.tier5"];

const STEPS: Array<{ icon: IconName; title: TranslationKey; body: TranslationKey }> = [
  { icon: "camera", title: "donate.step1", body: "donate.step1Body" },
  { icon: "copy", title: "donate.step2", body: "donate.step2Body" },
  { icon: "heart", title: "donate.step3", body: "donate.step3Body" },
];

/** The four free ways to help; each opens the video (or the channel) in a new tab. */
const FREE_STEPS: Array<{ icon: IconName; title: TranslationKey; body: TranslationKey; channel?: boolean }> = [
  { icon: "play", title: "donate.freeWatch", body: "donate.freeWatchBody" },
  { icon: "message", title: "donate.freeComment", body: "donate.freeCommentBody" },
  { icon: "heart", title: "donate.freeLike", body: "donate.freeLikeBody" },
  { icon: "users", title: "donate.freeSubscribe", body: "donate.freeSubscribeBody", channel: true },
];

/** Petals drifting behind the hero; positions are fixed so the layout never jumps. */
const PETALS = [
  { left: "6%", delay: "0s", duration: "11s", size: 12 },
  { left: "18%", delay: "3.5s", duration: "13s", size: 9 },
  { left: "31%", delay: "1.2s", duration: "10s", size: 14 },
  { left: "47%", delay: "5s", duration: "12s", size: 10 },
  { left: "60%", delay: "2.2s", duration: "14s", size: 13 },
  { left: "72%", delay: "6.5s", duration: "11s", size: 9 },
  { left: "84%", delay: "0.8s", duration: "13s", size: 12 },
  { left: "93%", delay: "4.2s", duration: "10s", size: 10 },
];

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function CopyButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
  const { t } = useUiLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      className={`donate-copy${copied ? " is-copied" : ""}`}
      onClick={copy}
      disabled={disabled}
      aria-label={copied ? t("donate.copied") : label}
      title={copied ? t("donate.copied") : label}
    >
      <Icon name={copied ? "check" : "copy"} size={16} strokeWidth={2} />
      <span>{copied ? t("donate.copied") : t("donate.copy")}</span>
    </button>
  );
}

const CHIP_ICONS: IconName[] = ["message", "heart", "users"];

/** Plain text where each **marked** part becomes a badge, so every language can put the badges where its grammar wants them. */
function ChipText({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="donate-chip">
            <Icon name={CHIP_ICONS[Math.floor(i / 2)] ?? "heart"} size={14} strokeWidth={2.2} />
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The thank-you voucher: a signed-in supporter saves it on their account, then sees its code. */
function VoucherPerk() {
  const { t } = useUiLanguage();
  const { user } = useAuth();
  const userId = user?._id;
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // a returning supporter already has one: show it instead of the button
  useEffect(() => {
    setVoucher(null);
    setFailed(false);
    if (!userId) return;
    const ctl = new AbortController();
    fetchMyVouchers(ctl.signal)
      .then((list) => setVoucher(supportVoucher(list) ?? null))
      .catch(() => {});
    return () => ctl.abort();
  }, [userId]);

  const claim = async () => {
    setSaving(true);
    setFailed(false);
    try {
      setVoucher(await claimSupportVoucher());
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`donate-voucher${voucher ? " is-claimed" : ""}`}>
      <span className="donate-voucher__icon" aria-hidden="true">
        <Icon name="ticket" size={26} strokeWidth={1.9} />
        <em>-10%</em>
      </span>
      <div className="donate-voucher__body">
        <strong>{t("donate.voucherTitle")}</strong>
        <span>{t("donate.voucherBody")}</span>
        {voucher ? (
          <div className="donate-voucher__got">
            <span className="donate-voucher__label">{t("donate.voucherCode")}</span>
            <div className="donate-voucher__row">
              <code>{voucher.code}</code>
              <CopyButton text={voucher.code} label={t("donate.voucherCopy")} />
            </div>
            <span className="donate-voucher__hint">{voucher.used ? t("donate.voucherUsed") : t("donate.voucherSaved")}</span>
          </div>
        ) : user ? (
          <div className="donate-voucher__act">
            <button type="button" className="btn btn--outline btn--sm" onClick={claim} disabled={saving}>
              <Icon name="ticket" size={16} />
              {saving ? t("donate.voucherClaiming") : t("donate.voucherClaim")}
            </button>
            {failed && <span className="donate-voucher__err" role="alert">{t("donate.voucherError")}</span>}
          </div>
        ) : (
          <span className="donate-voucher__hint">
            <Link to="/auth">{t("auth.login")}</Link> {t("donate.voucherLoginHint")}
          </span>
        )}
      </div>
    </div>
  );
}

export function DonatePage() {
  const { t } = useUiLanguage();
  const { user } = useAuth();
  const [amount, setAmount] = useState<number | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [qrPng, setQrPng] = useState("");

  // A signed-in supporter's email goes into the code, so the bank app opens with the transfer content filled in.
  const transferNote = user?.email ?? "";
  const payload = useMemo(
    () =>
      buildVietQr({
        bin: DONATE.bankBin,
        account: DONATE.accountNumber,
        amount: amount ?? undefined,
        memo: transferNote,
      }),
    [amount, transferNote],
  );

  useEffect(() => {
    let live = true;
    const opts = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#16181d", light: "#ffffff" } };
    Promise.all([
      QRCode.toString(payload, { ...opts, type: "svg" }),
      QRCode.toDataURL(payload, { ...opts, width: 720, margin: 3 }),
    ]).then(([svg, png]) => {
      if (!live) return;
      setQrSvg(svg);
      setQrPng(png);
    });
    return () => {
      live = false;
    };
  }, [payload]);

  return (
    <AppShell title={t("nav.donate")}>
      <div className="donate">
        <section className="donate-hero">
          <div className="donate-hero__petals" aria-hidden="true">
            {PETALS.map((p, i) => (
              <span
                key={i}
                style={{
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>
          <span className="donate-hero__kanji" aria-hidden="true">
            感謝
          </span>
          <span className="donate-hero__eyebrow">
            <Icon name="heart" size={16} strokeWidth={2.2} />
            {t("donate.eyebrow")}
          </span>
          <h1>{t("donate.title")}</h1>
          <p>{t("donate.sub")}</p>
        </section>

        <section className="donate-free" aria-labelledby="donate-free-title">
          <a className="donate-free__video" href={SUPPORT_VIDEO.url} target="_blank" rel="noopener noreferrer" aria-label={t("donate.freeCta")}>
            <span className="donate-free__badge">{t("donate.freeBadge")}</span>
            <span className="donate-free__play" aria-hidden="true">
              <Icon name="play" size={34} />
            </span>
          </a>
          <div className="donate-free__body">
            <span className="donate-free__eyebrow">
              <Icon name="heart" size={14} strokeWidth={2.4} />
              {t("donate.freeEyebrow")}
            </span>
            <h2 id="donate-free-title">{t("donate.freeTitle")}</h2>
            <p>
              <ChipText text={t("donate.freeSub")} />
            </p>
            <ul className="donate-free__steps">
              {FREE_STEPS.map((s) => (
                <li key={s.title}>
                  <a href={s.channel && SUPPORT_VIDEO.channelUrl ? SUPPORT_VIDEO.channelUrl : SUPPORT_VIDEO.url} target="_blank" rel="noopener noreferrer">
                    <span className="donate-free__icon" aria-hidden="true">
                      <Icon name={s.icon} size={18} />
                    </span>
                    <strong>{t(s.title)}</strong>
                    <span>{t(s.body)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <VoucherPerk />
            <div className="donate-free__cta">
              <a className="btn btn--primary donate-free__btn" href={SUPPORT_VIDEO.url} target="_blank" rel="noopener noreferrer">
                <Icon name="play" size={18} />
                {t("donate.freeCta")}
              </a>
              <span className="donate-free__note">{t("donate.freeNote")}</span>
            </div>
          </div>
        </section>

        <div className="donate__grid">
          <section className="donate-card" aria-labelledby="donate-qr-title">
            <div className="donate-card__inner">
              <div className="donate-card__head">
                <h2 id="donate-qr-title">{t("donate.scan")}</h2>
                <span className="donate-card__bank">{DONATE.bankName}</span>
              </div>

              <div className="donate-qr">
                {/* Keyed on the payload so each new code pops in. */}
                <div
                  key={payload}
                  className="donate-qr__code"
                  role="img"
                  aria-label={t("donate.qrAlt")}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <span className="donate-qr__amount">{amount ? formatVnd(amount) : t("donate.anyAmount")}</span>
              </div>

              <div className="donate-tiers" role="radiogroup" aria-label={t("donate.pickAmount")}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={amount === null}
                  className="donate-tier"
                  onClick={() => setAmount(null)}
                >
                  <strong>{t("donate.anyAmount")}</strong>
                  <span>{t("donate.tier0")}</span>
                </button>
                {DONATE.amounts.map((a, i) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={amount === a}
                    className="donate-tier"
                    onClick={() => setAmount(a)}
                  >
                    <strong>{formatVnd(a)}</strong>
                    <span>{t(AMOUNT_LABELS[i] ?? "donate.tier5")}</span>
                  </button>
                ))}
              </div>

              <dl className="donate-account">
                <div>
                  <dt>{t("donate.bank")}</dt>
                  <dd>{DONATE.bankName}</dd>
                </div>
                <div>
                  <dt>{t("donate.accountName")}</dt>
                  <dd>{DONATE.accountName}</dd>
                </div>
                <div>
                  <dt>{t("donate.accountNumber")}</dt>
                  <dd className="donate-account__number">
                    <span>{DONATE.accountNumber}</span>
                    <CopyButton text={DONATE.accountNumber} label={t("donate.copyAccount")} />
                  </dd>
                </div>
              </dl>

              {qrPng && (
                <a
                  className="btn btn--outline btn--block"
                  href={qrPng}
                  download={`kaitiq-donate${amount ? `-${amount}` : ""}.png`}
                >
                  <Icon name="download" size={18} />
                  {t("donate.saveQr")}
                </a>
              )}
            </div>
          </section>

          <div className="donate__side">
            <section className="donate-note" aria-labelledby="donate-note-title">
              <div className="donate-note__icon" aria-hidden="true">
                <Icon name="gift" size={22} />
              </div>
              <div className="donate-note__body">
                <h2 id="donate-note-title">{t("donate.noteTitle")}</h2>
                <p>{t("donate.note")}</p>
                <div className="donate-memo">
                  <span className="donate-memo__label">{t("donate.memoLabel")}</span>
                  <div className="donate-memo__row">
                    <code className={user ? "" : "is-placeholder"}>{user ? transferNote : t("donate.memoExample")}</code>
                    <CopyButton text={transferNote} label={t("donate.copyMemo")} disabled={!user} />
                  </div>
                  {!user && (
                    <span className="donate-memo__hint">
                      <Link to="/auth">{t("auth.login")}</Link> {t("donate.memoLogin")}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="panel card-pad donate-steps" aria-labelledby="donate-steps-title">
              <h2 id="donate-steps-title">{t("donate.howTitle")}</h2>
              <ol>
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <span className="donate-steps__num" aria-hidden="true">
                      <Icon name={s.icon} size={18} />
                      <em>{i + 1}</em>
                    </span>
                    <div>
                      <strong>{t(s.title)}</strong>
                      <span>{t(s.body)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <p className="donate-thanks">
              <Icon name="heart" size={16} strokeWidth={2.2} />
              {t("donate.thanks")}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
