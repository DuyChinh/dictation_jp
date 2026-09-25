import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import type { UiLang } from "../shared/i18n/translations";
import { PRICING } from "../config/pricing";

const FEATURES: Record<"free" | "pro" | "team", Record<UiLang, string[]>> = {
  free: {
    vi: ["Chế độ chép cả câu", "Chấm theo cách đọc, chấp nhận hiragana", "Lưu tiến độ khi đăng nhập"],
    ja: ["全文ディクテーション", "読み方で採点・ひらがなOK", "ログインで進捗を保存"],
    en: ["Full-sentence dictation", "Scored by reading, hiragana accepted", "Progress saved when signed in"],
  },
  pro: {
    vi: [
      "Toàn bộ đề JLPT hiện có và đề mới",
      "Điền từ mức vừa và khó",
      "Bản dịch tiếng Việt từng câu",
      "Nghe chọn đáp án kèm giải thích",
      "Thống kê tiến độ chi tiết",
    ],
    ja: ["すべてのJLPT問題と新しい問題", "穴埋め（普通・難しい）", "一文ごとのベトナム語訳", "解説付きの聴解問題", "詳しい進捗データ"],
    en: [
      "Every JLPT test, including new ones",
      "Medium and hard fill-in modes",
      "Line-by-line translation",
      "Multiple choice with explanations",
      "Detailed progress stats",
    ],
  },
  team: {
    vi: ["Mọi quyền lợi của gói Pro", "Tài khoản cho cả lớp", "Hỗ trợ và hoá đơn cho tổ chức"],
    ja: ["Proのすべての機能", "クラス全員のアカウント", "法人向けサポートと請求書"],
    en: ["Everything in Pro", "Accounts for the whole class", "Support and invoicing for organisations"],
  },
};

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="plan__features">
      {items.map((f) => (
        <li key={f}>
          <Icon name="check" size={18} strokeWidth={2.2} />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function PricingPage() {
  const { t, uiLang } = useUiLanguage();
  const [cycle, setCycle] = useState<"month" | "year">(PRICING.yearlyPrice ? "year" : "month");

  const price = cycle === "year" ? PRICING.yearlyPrice : PRICING.monthlyPrice;
  const unit = cycle === "year" ? t("pricing.perYear") : t("pricing.perMonth");
  const freeItems = PRICING.freeAllowance ? [PRICING.freeAllowance, ...FEATURES.free[uiLang]] : FEATURES.free[uiLang];
  const teamHref = PRICING.contactEmail ? `mailto:${PRICING.contactEmail}` : "";

  const faqs = [
    { q: t("pricing.faqCancelQ"), a: t("pricing.faqCancelA") },
    { q: t("pricing.faqPayQ"), a: PRICING.paymentMethods },
    { q: t("pricing.faqNewQ"), a: PRICING.newTestsPolicy },
  ].filter((f) => f.a);

  return (
    <AppShell title={t("nav.pro")}>
      <div className="pricing">
        <div className="pricing__intro">
          <h1>{t("pricing.title")}</h1>
          <p>{t("pricing.sub")}</p>
          {PRICING.monthlyPrice && PRICING.yearlyPrice && (
            <div className="segmented" role="radiogroup" aria-label={t("pricing.cycle")} style={{ marginTop: 8 }}>
              <button type="button" role="radio" aria-checked={cycle === "month"} onClick={() => setCycle("month")}>
                {t("pricing.monthly")}
              </button>
              <button type="button" role="radio" aria-checked={cycle === "year"} onClick={() => setCycle("year")}>
                {t("pricing.yearly")}
                {PRICING.yearlySavePercent > 0 ? ` · −${PRICING.yearlySavePercent}%` : ""}
              </button>
            </div>
          )}
        </div>

        <div className="plans">
          <article className="plan">
            <div className="plan__head">
              <div>
                <h2>{t("pricing.free")}</h2>
                <p>{t("pricing.freeSub")}</p>
              </div>
            </div>
            <div className="plan__price">
              <strong>0đ</strong>
            </div>
            <Link to="/auth?mode=register" className="btn btn--outline btn--lg btn--block">
              {t("pricing.ctaFree")}
            </Link>
            <FeatureList items={freeItems} />
          </article>

          <article className="plan plan--featured">
            <div className="plan__head">
              <div>
                <h2>{t("pricing.pro")}</h2>
                <p>{t("pricing.proSub")}</p>
              </div>
              <span className="plan__tag">{t("pricing.popular")}</span>
            </div>
            <div className="plan__price">
              <strong>{price || t("pricing.soon")}</strong>
              {price && <span>{unit}</span>}
            </div>
            {PRICING.upgradeUrl ? (
              <a href={PRICING.upgradeUrl} className="btn btn--light btn--lg btn--block">
                {t("pricing.ctaPro")}
              </a>
            ) : (
              <Link to="/auth?mode=register" className="btn btn--light btn--lg btn--block">
                {t("pricing.notify")}
              </Link>
            )}
            <FeatureList items={FEATURES.pro[uiLang]} />
          </article>

          <article className="plan">
            <div className="plan__head">
              <div>
                <h2>{t("pricing.team")}</h2>
                <p>{t("pricing.teamSub")}</p>
              </div>
            </div>
            <div className="plan__price">
              <strong>{t("pricing.contact")}</strong>
            </div>
            {teamHref ? (
              <a href={teamHref} className="btn btn--outline btn--lg btn--block">
                {t("pricing.ctaTeam")}
              </a>
            ) : (
              <Link to="/auth?mode=register" className="btn btn--outline btn--lg btn--block">
                {t("pricing.notify")}
              </Link>
            )}
            <FeatureList items={FEATURES.team[uiLang]} />
          </article>
        </div>

        {faqs.length > 0 && (
          <div className="faq">
            {faqs.map((f) => (
              <div key={f.q}>
                <strong>{f.q}</strong>
                <span>{f.a}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
