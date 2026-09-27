import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import { ApiError } from "../../shared/api/client";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../auth/LoginButton";
import {
  deleteReply,
  listReplies,
  listReplyReactors,
  MAX_REPLY_IMAGES,
  postReply,
  reactToReply,
  updateReply,
  type FeedbackReply,
  type Reaction,
} from "./feedbackApi";
import { AttachmentStrip, ComposerTools, ImageGallery, insertAtCaret, ReactionBar } from "./FeedbackParts";
import { applyReaction, LOCALE, MAX_LEN, timeAgo } from "./feedbackMeta";
import { useAttachments } from "./useAttachments";

/** Text box with emoji and picture buttons; Ctrl/⌘+Enter sends. */
function ReplyBox({
  value,
  onChange,
  attachments,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
  textareaRef,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  attachments: ReturnType<typeof useAttachments>;
  onSubmit: () => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autoFocus?: boolean;
}) {
  const { t } = useUiLanguage();
  const ready = (value.trim().length > 0 || attachments.urls.length > 0) && !attachments.uploading && !busy;

  return (
    <form
      className="fb-replybox"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
    >
      <textarea
        ref={textareaRef}
        rows={2}
        maxLength={MAX_LEN}
        value={value}
        autoFocus={autoFocus}
        placeholder={t("feedback.replyPh")}
        aria-label={t("feedback.replyPh")}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (ready) onSubmit();
          }
          if (e.key === "Escape" && onCancel) onCancel();
        }}
      />
      <AttachmentStrip attachments={attachments} />
      <div className="fb-replybox__foot">
        <ComposerTools
          attachments={attachments}
          onEmoji={(emoji) => insertAtCaret(textareaRef.current, value, emoji, onChange, MAX_LEN)}
        />
        <div className="fb-edit__actions">
          {onCancel && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
              {t("feedback.cancel")}
            </button>
          )}
          <button type="submit" className="btn btn--primary btn--sm" disabled={!ready}>
            <Icon name="send" size={15} />
            {busy ? t("auth.wait") : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function ReplyItem({
  reply,
  onChange,
  onRemove,
  onReply,
  nested,
}: {
  reply: FeedbackReply;
  onChange: (r: FeedbackReply) => void;
  /** `removed` counts the reply and any under it. */
  onRemove: (id: string, removed: number) => void;
  onReply: (name: string) => void;
  nested?: boolean;
}) {
  const { user } = useAuth();
  const { t, uiLang } = useUiLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const attachments = useAttachments(MAX_REPLY_IMAGES, reply.images);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const name = reply.author.name || t("feedback.formerUser");

  const react = async (emoji: Reaction) => {
    const before = reply;
    onChange({ ...reply, ...applyReaction(reply.reactions, reply.myReaction, emoji) });
    try {
      const res = await reactToReply(reply.id, emoji);
      onChange({ ...before, ...res });
    } catch {
      onChange(before);
    }
  };

  const startEdit = () => {
    setDraft(reply.body);
    attachments.reset(reply.images);
    setError(false);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      const { item } = await updateReply(reply.id, { body: draft.trim(), images: attachments.urls });
      onChange(item);
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("feedback.confirmDeleteReply"))) return;
    try {
      const { deleted } = await deleteReply(reply.id);
      onRemove(reply.id, deleted);
    } catch {
      window.alert(t("auth.error"));
    }
  };

  return (
    <div className={`fb-reply-item${nested ? " is-nested" : ""}`}>
      <UserAvatar
        user={{ _id: "", email: "", displayName: name, avatar: reply.author.avatar ?? undefined }}
        className="account__avatar fb-reply-item__avatar"
      />
      <div className="fb-reply-item__main">
        {editing ? (
          <>
            <ReplyBox
              value={draft}
              onChange={setDraft}
              attachments={attachments}
              onSubmit={save}
              onCancel={() => setEditing(false)}
              busy={busy}
              submitLabel={t("feedback.save")}
              textareaRef={editRef}
              autoFocus
            />
            {error && (
              <div className="alert" role="alert">
                {t("auth.error")}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="fb-bubble">
              <span className="fb-bubble__name">
                {name}
                {reply.mine && <span className="fb-card__you">{t("feedback.you")}</span>}
              </span>
              {reply.body && <p>{reply.body}</p>}
            </div>
            <ImageGallery images={reply.images} compact />
            <div className="fb-reply-item__bar">
              <time dateTime={reply.createdAt}>{timeAgo(reply.createdAt, uiLang)}</time>
              {reply.editedAt && (
                <span className="fb-card__edited" title={new Date(reply.editedAt).toLocaleString(LOCALE[uiLang])}>
                  ({t("feedback.edited")})
                </span>
              )}
              <ReactionBar
                reactions={reply.reactions}
                mine={reply.myReaction}
                signedIn={!!user}
                onReact={react}
                loadReactors={() => listReplyReactors(reply.id)}
                small
              />
              {user && (
                <button type="button" className="fb-text-btn" onClick={() => onReply(name)}>
                  {t("feedback.reply")}
                </button>
              )}
              {reply.mine && (
                <>
                  <button type="button" className="fb-text-btn" onClick={startEdit}>
                    {t("feedback.edit")}
                  </button>
                  <button type="button" className="fb-text-btn is-danger" onClick={remove}>
                    {t("feedback.delete")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A reply box with its own draft; `parentId` puts the reply under another one. */
function ReplyComposer({
  feedbackId,
  parentId,
  initial = "",
  autoFocus,
  focusSignal = 0,
  onSent,
  onCancel,
  nested,
}: {
  feedbackId: string;
  parentId?: string;
  initial?: string;
  autoFocus?: boolean;
  focusSignal?: number;
  onSent: (reply: FeedbackReply) => void;
  onCancel?: () => void;
  nested?: boolean;
}) {
  const { user } = useAuth();
  const { t } = useUiLanguage();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useAttachments(MAX_REPLY_IMAGES);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus && focusSignal === 0) return;
    const el = boxRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [autoFocus, focusSignal]);

  if (!user) return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { item } = await postReply(feedbackId, { body: draft.trim(), images: attachments.urls, parentId });
      setDraft("");
      attachments.reset();
      onSent(item);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "RATE_LIMITED" ? t("feedback.rateLimited") : t("auth.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`fb-thread__compose${nested ? " is-nested" : ""}`}>
      <UserAvatar user={user} className="account__avatar fb-reply-item__avatar" />
      <div className="fb-reply-item__main">
        <ReplyBox
          value={draft}
          onChange={setDraft}
          attachments={attachments}
          onSubmit={send}
          onCancel={onCancel}
          busy={busy}
          submitLabel={t("feedback.sendReply")}
          textareaRef={boxRef}
        />
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Replies under one post, Facebook-style: replies to the post, each with its own indented
 * replies and a box that opens under it. Loads when first opened.
 */
export function ReplyThread({
  feedbackId,
  onCountChange,
  focusSignal,
}: {
  feedbackId: string;
  onCountChange: (delta: number) => void;
  /** Bumped by the card's Reply button to put the caret in the bottom box. */
  focusSignal: number;
}) {
  const { user } = useAuth();
  const { t } = useUiLanguage();
  const [items, setItems] = useState<FeedbackReply[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  /** Which top-level reply has its nested box open, and who is being answered. */
  const [replyTo, setReplyTo] = useState<{ rootId: string; name: string; key: number } | null>(null);

  const load = () => {
    setLoadError(false);
    listReplies(feedbackId)
      .then((d) => setItems(d.items))
      .catch(() => setLoadError(true));
  };

  useEffect(load, [feedbackId, user?._id]);

  const list = items ?? [];
  const ids = new Set(list.map((r) => r.id));
  // A reply whose parent is gone shows at the top level rather than disappearing.
  const roots = list.filter((r) => !r.parentId || !ids.has(r.parentId));
  const childrenOf = (id: string) => list.filter((r) => r.parentId === id);

  const update = (next: FeedbackReply) => setItems((prev) => prev?.map((x) => (x.id === next.id ? next : x)) ?? prev);

  const remove = (id: string, removed: number) => {
    setItems((prev) => prev?.filter((x) => x.id !== id && x.parentId !== id) ?? prev);
    if (replyTo?.rootId === id) setReplyTo(null);
    onCountChange(-removed);
  };

  const added = (reply: FeedbackReply) => {
    setItems((prev) => [...(prev ?? []), reply]);
    onCountChange(1);
  };

  const answer = (rootId: string, name: string) => setReplyTo({ rootId, name, key: Date.now() });

  return (
    <div className="fb-thread">
      {loadError && (
        <button type="button" className="fb-text-btn" onClick={load}>
          {t("feedback.loadError")} {t("feedback.retry")}
        </button>
      )}
      {items === null && !loadError && <div className="fb-thread__loading" aria-busy="true" />}
      {roots.length > 0 && (
        <ul className="fb-thread__list">
          {roots.map((root) => {
            const children = childrenOf(root.id);
            const composing = replyTo?.rootId === root.id;
            return (
              <li key={root.id} className="fb-thread__group">
                <ReplyItem
                  reply={root}
                  onChange={update}
                  onRemove={remove}
                  onReply={(name) => answer(root.id, name)}
                />
                {(children.length > 0 || composing) && (
                  <ul className="fb-thread__children">
                    {children.map((child) => (
                      <li key={child.id}>
                        <ReplyItem
                          reply={child}
                          nested
                          onChange={update}
                          onRemove={remove}
                          onReply={(name) => answer(root.id, name)}
                        />
                      </li>
                    ))}
                    {composing && (
                      <li>
                        <ReplyComposer
                          key={replyTo.key}
                          feedbackId={feedbackId}
                          parentId={root.id}
                          initial={`@${replyTo.name} `}
                          autoFocus
                          nested
                          onSent={(reply) => {
                            added(reply);
                            setReplyTo(null);
                          }}
                          onCancel={() => setReplyTo(null)}
                        />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {user ? (
        <ReplyComposer feedbackId={feedbackId} focusSignal={focusSignal} onSent={added} />
      ) : (
        <p className="fb-thread__guest">
          <Link to="/auth">{t("auth.login")}</Link> {t("feedback.loginToReply")}
        </p>
      )}
    </div>
  );
}
