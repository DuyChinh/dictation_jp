import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../shared/ui/AppShell";
import { Icon } from "../shared/ui/Icon";
import { useUiLanguage } from "../shared/i18n/UiLanguageContext";
import { ApiError } from "../shared/api/client";
import { triggerConfetti } from "../shared/utils/confetti";
import { useAuth } from "../features/auth/AuthContext";
import {
  FEEDBACK_CATEGORIES,
  listFeedback,
  MAX_POST_IMAGES,
  postFeedback,
  type FeedbackCategory,
  type FeedbackItem,
  type FeedbackPage as FeedbackPageData,
  type FeedbackSort,
} from "../features/feedback/feedbackApi";
import { FeedbackCard } from "../features/feedback/FeedbackCard";
import { AttachmentStrip, ComposerTools, insertAtCaret } from "../features/feedback/FeedbackParts";
import { CATEGORY, MAX_LEN, MIN_LEN } from "../features/feedback/feedbackMeta";
import { useAttachments } from "../features/feedback/useAttachments";

/** Counts up to `target` once it is known, for the hero numbers. */
function useCountUp(target: number | null): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function Stat({ value, label }: { value: number | null; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className="fb-stat">
      <strong>{value === null ? "—" : shown}</strong>
      <span>{label}</span>
    </div>
  );
}

function Composer({ onPosted }: { onPosted: (item: FeedbackItem) => void }) {
  const { user } = useAuth();
  const { t } = useUiLanguage();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanked, setThanked] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const attachments = useAttachments(MAX_POST_IMAGES);

  const len = body.trim().length;
  const ready = len >= MIN_LEN && len <= MAX_LEN && !attachments.uploading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { item } = await postFeedback({ category, body: body.trim(), images: attachments.urls });
      setBody("");
      attachments.reset();
      setThanked(true);
      onPosted(item);
      const rect = submitRef.current?.getBoundingClientRect();
      if (rect) triggerConfetti({ particleCount: 70, origin: { x: rect.left + rect.width / 2, y: rect.top } });
    } catch (err) {
      setError(err instanceof ApiError && err.code === "RATE_LIMITED" ? t("feedback.rateLimited") : t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fb-composer" aria-labelledby="fb-compose-title">
      <div className="fb-composer__head">
        <h2 id="fb-compose-title">{t("feedback.composeTitle")}</h2>
        <p>{t("feedback.composeSub")}</p>
      </div>

      <div className="fb-cats" role="radiogroup" aria-label={t("feedback.pickCategory")}>
        {FEEDBACK_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            className={`fb-cat fb-cat--${c}`}
            onClick={() => setCategory(c)}
          >
            <span className="fb-cat__icon" aria-hidden="true">
              <Icon name={CATEGORY[c].icon} size={20} />
            </span>
            <span className="fb-cat__text">
              <strong>{t(CATEGORY[c].label)}</strong>
              <span>{t(CATEGORY[c].hint)}</span>
            </span>
          </button>
        ))}
      </div>

      <form className="fb-form" onSubmit={submit}>
        <div className={`fb-input${user ? "" : " is-locked"}`}>
          <label htmlFor="fb-body" className="visually-hidden">
            {t("feedback.bodyLabel")}
          </label>
          <textarea
            ref={bodyRef}
            id="fb-body"
            rows={5}
            maxLength={MAX_LEN}
            value={body}
            disabled={!user}
            onChange={(e) => {
              setBody(e.target.value);
              if (thanked) setThanked(false);
            }}
            placeholder={t(CATEGORY[category].placeholder)}
          />
          {!user && (
            <div className="fb-input__lock">
              <Icon name="lock" size={20} />
              <span>{t("feedback.loginToPost")}</span>
              <Link to="/auth" className="btn btn--primary btn--sm">
                {t("auth.login")}
              </Link>
            </div>
          )}
        </div>

        {user && <AttachmentStrip attachments={attachments} />}

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {thanked && (
          <div className="fb-thanks" role="status">
            <Icon name="sparkles" size={18} />
            {t("feedback.thanks")}
          </div>
        )}

        <div className="fb-form__foot">
          <ComposerTools
            attachments={attachments}
            disabled={!user}
            onEmoji={(emoji) => insertAtCaret(bodyRef.current, body, emoji, setBody, MAX_LEN)}
          />
          <span className={`fb-count${len > MAX_LEN * 0.9 ? " is-near" : ""}`}>
            {len}/{MAX_LEN}
          </span>
          <button ref={submitRef} type="submit" className="btn btn--primary" disabled={!user || !ready || busy}>
            <Icon name="send" size={18} />
            {busy ? t("auth.wait") : t("feedback.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}

export function FeedbackPage() {
  const { t } = useUiLanguage();
  const { user, loading: authLoading } = useAuth();
  const [sort, setSort] = useState<FeedbackSort>("new");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [data, setData] = useState<FeedbackPageData | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const seq = useRef(0);

  const load = async (nextPage: number) => {
    const id = ++seq.current;
    setLoading(true);
    setError(false);
    try {
      const d = await listFeedback({ sort, category, page: nextPage });
      if (id !== seq.current) return;
      setData(d);
      setPage(nextPage);
      setItems((prev) => {
        if (nextPage === 1) return d.items;
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...d.items.filter((i) => !seen.has(i.id))];
      });
    } catch {
      if (id === seq.current) setError(true);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };

  // Reload when the filters change, and once sign-in is known so likes and "you" are right.
  useEffect(() => {
    if (authLoading) return;
    void load(1);
  }, [sort, category, authLoading, user?._id]);

  const onPosted = (item: FeedbackItem) => {
    setFreshId(item.id);
    setItems((prev) => {
      const pinned = prev.filter((i) => i.pinned);
      return [...pinned, item, ...prev.filter((i) => !i.pinned)];
    });
    setData((d) => d && { ...d, total: d.total + 1, stats: { ...d.stats, total: d.stats.total + 1 } });
  };

  const onChange = (next: FeedbackItem) => setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));

  const onRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setData((d) => d && { ...d, total: d.total - 1, stats: { ...d.stats, total: d.stats.total - 1 } });
  };

  const hasMore = data !== null && items.length < data.total;

  return (
    <AppShell title={t("nav.feedback")}>
      <div className="fb">
        <section className="fb-hero">
          <div className="fb-hero__text">
            <span className="fb-hero__eyebrow">
              <Icon name="sparkles" size={16} />
              {t("feedback.eyebrow")}
            </span>
            <h1>{t("feedback.title")}</h1>
            <p>{t("feedback.sub")}</p>
          </div>
          <div className="fb-hero__stats">
            <Stat value={data?.stats.total ?? null} label={t("feedback.statTotal")} />
            <Stat value={data?.stats.planned ?? null} label={t("feedback.statPlanned")} />
            <Stat value={data?.stats.done ?? null} label={t("feedback.statDone")} />
          </div>
          <div className="fb-hero__bubbles" aria-hidden="true">
            <span>💡</span>
            <span>🛠️</span>
            <span>📚</span>
            <span>💬</span>
          </div>
        </section>

        <div className="fb__grid">
          <Composer onPosted={onPosted} />

          <section className="fb-board" aria-labelledby="fb-board-title">
            <div className="fb-board__head">
              <h2 id="fb-board-title">{t("feedback.boardTitle")}</h2>
              <div className="segmented" role="radiogroup" aria-label={t("feedback.sortLabel")}>
                <button type="button" role="radio" aria-checked={sort === "new"} onClick={() => setSort("new")}>
                  {t("feedback.sortNew")}
                </button>
                <button type="button" role="radio" aria-checked={sort === "top"} onClick={() => setSort("top")}>
                  {t("feedback.sortTop")}
                </button>
              </div>
            </div>

            <div className="fb-filter" role="radiogroup" aria-label={t("feedback.filterLabel")}>
              <button type="button" role="radio" aria-checked={category === ""} onClick={() => setCategory("")}>
                {t("feedback.all")}
              </button>
              {FEEDBACK_CATEGORIES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}>
                  <Icon name={CATEGORY[c].icon} size={15} />
                  {t(CATEGORY[c].label)}
                </button>
              ))}
            </div>

            {error && (
              <div className="notice notice--error">
                <Icon name="alert" />
                <span>{t("feedback.loadError")}</span>
                <button type="button" className="btn btn--outline btn--sm" style={{ marginLeft: "auto" }} onClick={() => load(1)}>
                  {t("feedback.retry")}
                </button>
              </div>
            )}

            {!error && items.length === 0 && !loading && (
              <div className="fb-empty">
                <span aria-hidden="true">🌱</span>
                <strong>{t("feedback.emptyTitle")}</strong>
                <p>{t("feedback.emptyBody")}</p>
              </div>
            )}

            {items.length === 0 && loading && (
              <div className="fb-list" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="fb-card fb-card--skeleton" />
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="fb-list">
                {items.map((item) => (
                  <FeedbackCard key={item.id} item={item} fresh={item.id === freshId} onChange={onChange} onRemove={onRemove} />
                ))}
              </div>
            )}

            {hasMore && (
              <button type="button" className="btn btn--outline btn--block" onClick={() => load(page + 1)} disabled={loading}>
                {loading ? t("auth.wait") : t("feedback.more")}
              </button>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
