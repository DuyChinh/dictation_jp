import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { fmt } from "../../shared/i18n/format";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../auth/LoginButton";
import {
  deleteFeedback,
  FEEDBACK_CATEGORIES,
  MAX_POST_IMAGES,
  listPostReactors,
  reactToFeedback,
  toggleFeedbackLike,
  updateFeedback,
  type FeedbackCategory,
  type FeedbackItem,
  type Reaction,
} from "./feedbackApi";
import {
  AttachmentStrip,
  ComposerTools,
  ImageGallery,
  insertAtCaret,
  ReactionBar,
  VideoGallery,
  VideoLinksEditor,
} from "./FeedbackParts";
import { useVideoLinks } from "./useVideoLinks";
import { applyReaction, CATEGORY, LOCALE, MAX_LEN, MIN_LEN, STATUS, timeAgo } from "./feedbackMeta";
import { ReplyThread } from "./ReplyThread";
import { useAttachments } from "./useAttachments";

export function FeedbackCard({
  item,
  fresh,
  onChange,
  onRemove,
}: {
  item: FeedbackItem;
  fresh: boolean;
  onChange: (item: FeedbackItem) => void;
  onRemove: (id: string) => void;
}) {
  const { user } = useAuth();
  const { t, uiLang } = useUiLanguage();
  const [pop, setPop] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const [draftCategory, setDraftCategory] = useState<FeedbackCategory>(item.category);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const attachments = useAttachments(MAX_POST_IMAGES, item.images);
  const video = useVideoLinks(item.videos);
  const editRef = useRef<HTMLTextAreaElement>(null);
  // Replies and reactions answer after a delay; build on the item as it is by then.
  const latest = useRef(item);
  latest.current = item;
  const cat = CATEGORY[item.category];
  const status = STATUS[item.status];
  const isTeam = item.author.kind === "team";
  const name = isTeam ? t("feedback.team") : item.author.name || t("feedback.formerUser");

  const like = async () => {
    const optimistic = { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) };
    onChange(optimistic);
    if (optimistic.liked) setPop(true);
    try {
      const res = await toggleFeedbackLike(item.id);
      onChange({ ...optimistic, likes: res.likes, liked: res.liked });
    } catch {
      onChange(item);
    }
  };

  const react = async (emoji: Reaction) => {
    onChange({ ...item, ...applyReaction(item.reactions, item.myReaction, emoji) });
    try {
      const res = await reactToFeedback(item.id, emoji);
      onChange({ ...latest.current, ...res });
    } catch {
      onChange(item);
    }
  };

  const openThread = () => {
    setThreadOpen(true);
    setFocusSignal((n) => n + 1);
  };

  const startEdit = () => {
    setDraft(item.body);
    setDraftCategory(item.category);
    attachments.reset(item.images);
    video.reset(item.videos);
    setEditError(false);
    setEditing(true);
  };

  const draftLen = draft.trim().length;
  const canSave = draftLen >= MIN_LEN && draftLen <= MAX_LEN && !saving && !attachments.uploading;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setEditError(false);
    try {
      const { item: next } = await updateFeedback(item.id, {
        category: draftCategory,
        body: draft.trim(),
        images: attachments.urls,
        videos: video.videos,
      });
      onChange(next);
      setEditing(false);
    } catch {
      setEditError(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("feedback.confirmDelete"))) return;
    try {
      await deleteFeedback(item.id);
      onRemove(item.id);
    } catch {
      window.alert(t("auth.error"));
    }
  };

  return (
    <article className={`fb-card${item.pinned ? " is-pinned" : ""}${isTeam ? " is-team" : ""}${fresh ? " is-fresh" : ""}`}>
      <header className="fb-card__head">
        {isTeam ? (
          <img className="fb-card__avatar fb-card__avatar--team" src="/logo.png" alt="" />
        ) : (
          <UserAvatar
            user={{ _id: "", email: "", displayName: name, avatar: item.author.avatar ?? undefined }}
            className="account__avatar fb-card__avatar"
          />
        )}
        <div className="fb-card__who">
          <span className="fb-card__name">
            {name}
            {isTeam && <span className="fb-card__team-tag">{t("feedback.teamTag")}</span>}
            {item.mine && <span className="fb-card__you">{t("feedback.you")}</span>}
          </span>
          <span className="fb-card__meta">
            <time dateTime={item.createdAt}>{timeAgo(item.createdAt, uiLang)}</time>
            {item.editedAt && (
              <span className="fb-card__edited" title={new Date(item.editedAt).toLocaleString(LOCALE[uiLang])}>
                ({t("feedback.edited")})
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className={`fb-tag fb-tag--${item.category}`}>
              <Icon name={cat.icon} size={13} strokeWidth={2.2} />
              {t(cat.label)}
            </span>
          </span>
        </div>
        <div className="fb-card__flags">
          {item.pinned && (
            <span className="fb-pin" title={t("feedback.pinned")}>
              <Icon name="pin" size={14} strokeWidth={2.2} />
              <span>{t("feedback.pinned")}</span>
            </span>
          )}
          {!isTeam && (
            <span className={`fb-status fb-status--${item.status}`}>
              <Icon name={status.icon} size={13} strokeWidth={2.4} />
              {t(status.label)}
            </span>
          )}
        </div>
      </header>

      {editing ? (
        <form
          className="fb-edit"
          onSubmit={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        >
          <div className="fb-filter fb-edit__cats" role="radiogroup" aria-label={t("feedback.pickCategory")}>
            {FEEDBACK_CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draftCategory === c} onClick={() => setDraftCategory(c)}>
                <Icon name={CATEGORY[c].icon} size={15} />
                {t(CATEGORY[c].label)}
              </button>
            ))}
          </div>
          <div className="fb-input">
            <label htmlFor={`fb-edit-${item.id}`} className="visually-hidden">
              {t("feedback.bodyLabel")}
            </label>
            <textarea
              ref={editRef}
              id={`fb-edit-${item.id}`}
              rows={4}
              maxLength={MAX_LEN}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          </div>
          <AttachmentStrip attachments={attachments} />
          <VideoLinksEditor video={video} />
          {editError && (
            <div className="alert" role="alert">
              {t("auth.error")}
            </div>
          )}
          {item.adminReply && <p className="fb-edit__note">{t("feedback.editReplyNote")}</p>}
          <div className="fb-form__foot">
            <ComposerTools
              attachments={attachments}
              video={video}
              onEmoji={(emoji) => insertAtCaret(editRef.current, draft, emoji, setDraft, MAX_LEN)}
            />
            <div className="fb-edit__actions">
              <span className="fb-count">
                {draftLen}/{MAX_LEN}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
                {t("feedback.cancel")}
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={!canSave}>
                {saving ? t("auth.wait") : t("feedback.save")}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <p className="fb-card__body">{item.body}</p>
          <ImageGallery images={item.images} />
          <VideoGallery videos={item.videos} />
        </>
      )}

      {item.adminReply && (
        <div className="fb-reply">
          <span className="fb-reply__head">
            <img src="/logo.png" alt="" aria-hidden="true" />
            {t("feedback.replyFrom")}
            {item.repliedAt && <time dateTime={item.repliedAt}>{timeAgo(item.repliedAt, uiLang)}</time>}
          </span>
          <p>{item.adminReply}</p>
        </div>
      )}

      <footer className="fb-card__foot">
        {user ? (
          <button
            type="button"
            className={`fb-like${item.liked ? " is-liked" : ""}${pop ? " is-pop" : ""}`}
            onClick={like}
            onAnimationEnd={() => setPop(false)}
            aria-pressed={item.liked}
          >
            <Icon name="thumbUp" size={17} strokeWidth={2} />
            <span>{t("feedback.metoo")}</span>
            <strong>{item.likes}</strong>
          </button>
        ) : (
          <Link to="/auth" className="fb-like" title={t("feedback.loginToLike")}>
            <Icon name="thumbUp" size={17} strokeWidth={2} />
            <span>{t("feedback.metoo")}</span>
            <strong>{item.likes}</strong>
          </Link>
        )}
        <ReactionBar
          reactions={item.reactions}
          mine={item.myReaction}
          signedIn={!!user}
          onReact={react}
          loadReactors={() => listPostReactors(item.id)}
        />
        <button
          type="button"
          className={`fb-reply-toggle${threadOpen ? " is-open" : ""}`}
          onClick={() => (threadOpen ? setThreadOpen(false) : openThread())}
          aria-expanded={threadOpen}
        >
          <Icon name="reply" size={17} />
          <span>{t("feedback.reply")}</span>
          {item.replyCount > 0 && <strong>{item.replyCount}</strong>}
        </button>
        {item.mine && !editing && (
          <div className="fb-card__own">
            <button type="button" className="fb-own-btn" onClick={startEdit} aria-label={t("feedback.edit")} title={t("feedback.edit")}>
              <Icon name="pencil" size={16} />
              <span>{t("feedback.edit")}</span>
            </button>
            <button
              type="button"
              className="fb-own-btn fb-own-btn--danger"
              onClick={remove}
              aria-label={t("feedback.delete")}
              title={t("feedback.delete")}
            >
              <Icon name="trash" size={16} />
              <span>{t("feedback.delete")}</span>
            </button>
          </div>
        )}
      </footer>

      {!threadOpen && item.replyCount > 0 && (
        <button type="button" className="fb-thread-peek" onClick={() => setThreadOpen(true)}>
          <Icon name="message" size={15} />
          {fmt(t(item.replyCount === 1 ? "feedback.viewReply" : "feedback.viewReplies"), { n: item.replyCount })}
        </button>
      )}
      {threadOpen && (
        <ReplyThread
          feedbackId={item.id}
          focusSignal={focusSignal}
          onCountChange={(d) =>
            onChange({ ...latest.current, replyCount: Math.max(0, latest.current.replyCount + d) })
          }
        />
      )}
    </article>
  );
}
