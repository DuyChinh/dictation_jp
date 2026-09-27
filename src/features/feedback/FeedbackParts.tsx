import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../shared/ui/Icon";
import { useUiLanguage } from "../../shared/i18n/UiLanguageContext";
import type { TranslationKey } from "../../shared/i18n/translations";
import { fmt } from "../../shared/i18n/format";
import { REACTIONS, type Reaction, type ReactionCount, type Reactors } from "./feedbackApi";
import type { Attachments } from "./useAttachments";

const EMOJI_GROUPS: Array<{ label: TranslationKey; emojis: string[] }> = [
  {
    label: "feedback.emoji.smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😜", "🤔", "🤗", "🤭", "😎", "🥳", "😴"],
  },
  {
    label: "feedback.emoji.feelings",
    emojis: ["😐", "🙄", "😬", "😮", "😲", "😳", "🥺", "🥲", "😢", "😭", "😤", "😠", "😡", "🤯", "😱", "😓"],
  },
  {
    label: "feedback.emoji.gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "💪", "👌", "✌️", "🤞", "👋", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜", "💯", "🔥", "✨", "🎉", "⭐", "💡", "✅"],
  },
  {
    label: "feedback.emoji.study",
    emojis: ["📚", "📖", "✏️", "📝", "🎧", "🗣️", "🇯🇵", "🇻🇳", "🌸", "🍵", "🍙", "🗾", "⛩️", "🎌", "❓", "❗", "🐛", "🚀"],
  },
];

/** Closes a popover on an outside click or Escape. */
function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, root]);
}

/** Puts `text` where the caret is in the textarea and keeps typing from there. */
export function insertAtCaret(
  el: HTMLTextAreaElement | null,
  value: string,
  text: string,
  setValue: (v: string) => void,
  max: number,
) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = (value.slice(0, start) + text + value.slice(end)).slice(0, max);
  setValue(next);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    const caret = Math.min(next.length, start + text.length);
    el.setSelectionRange(caret, caret);
  });
}

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), root);

  return (
    <div className="fb-pop" ref={root}>
      <button
        type="button"
        className="fb-tool"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={t("feedback.addEmoji")}
        title={t("feedback.addEmoji")}
      >
        <Icon name="smile" size={19} />
      </button>
      {open && (
        <div className="fb-pop__panel fb-emoji" role="dialog" aria-label={t("feedback.addEmoji")}>
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="fb-emoji__group">
              <span className="fb-emoji__label">{t(g.label)}</span>
              <div className="fb-emoji__grid">
                {g.emojis.map((e) => (
                  <button key={e} type="button" onClick={() => onPick(e)} aria-label={e}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Emoji and picture buttons under a text box. */
export function ComposerTools({
  attachments,
  onEmoji,
  disabled,
}: {
  attachments: Attachments;
  onEmoji: (emoji: string) => void;
  disabled?: boolean;
}) {
  const { t } = useUiLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="fb-tools">
      <EmojiPicker onPick={onEmoji} disabled={disabled} />
      <button
        type="button"
        className="fb-tool"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || attachments.full}
        aria-label={t("feedback.addImage")}
        title={attachments.full ? t("feedback.imagesFull") : t("feedback.addImage")}
      >
        <Icon name="image" size={19} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) attachments.add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const PROBLEM_TEXT: Record<NonNullable<Attachments["problem"]>, TranslationKey> = {
  size: "profile.avatarTooBig",
  type: "profile.avatarBadFile",
  count: "feedback.imagesFull",
  upload: "feedback.uploadFailed",
};

/** Thumbnails of the pictures picked so far, each removable. */
export function AttachmentStrip({ attachments }: { attachments: Attachments }) {
  const { t } = useUiLanguage();
  if (!attachments.items.length && !attachments.problem) return null;
  return (
    <div className="fb-attach">
      {attachments.items.length > 0 && (
        <div className="fb-attach__list">
          {attachments.items.map((a) => (
            <div key={a.key} className={`fb-attach__item${a.status === "uploading" ? " is-uploading" : ""}`}>
              <img src={a.preview} alt="" />
              {a.status === "uploading" && <span className="fb-attach__spin" aria-label={t("feedback.uploading")} />}
              <button
                type="button"
                className="fb-attach__remove"
                onClick={() => attachments.remove(a.key)}
                aria-label={t("feedback.removeImage")}
              >
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachments.problem && <span className="fb-attach__problem">{t(PROBLEM_TEXT[attachments.problem])}</span>}
    </div>
  );
}

/** Pictures on a post or reply; a click opens them full size. */
export function ImageGallery({ images, compact }: { images: string[]; compact?: boolean }) {
  const { t } = useUiLanguage();
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (index !== null && !el.open) el.showModal();
    if (index === null && el.open) el.close();
  }, [index]);

  if (!images.length) return null;
  const step = (d: number) => setIndex((i) => (i === null ? i : (i + d + images.length) % images.length));

  return (
    <>
      <div className={`fb-gallery fb-gallery--${Math.min(images.length, 4)}${compact ? " is-compact" : ""}`}>
        {images.map((src, i) => (
          <button key={src} type="button" className="fb-gallery__item" onClick={() => setIndex(i)} aria-label={t("feedback.openImage")}>
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="fb-lightbox"
        onCancel={(e) => {
          e.preventDefault();
          setIndex(null);
        }}
        onClick={(e) => {
          if (e.target === dialog.current) setIndex(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        {index !== null && (
          <>
            <img src={images[index]} alt="" />
            <button type="button" className="fb-lightbox__close" onClick={() => setIndex(null)} aria-label={t("nav.closeMenu")}>
              <Icon name="close" size={22} />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" className="fb-lightbox__nav is-prev" onClick={() => step(-1)} aria-label="←">
                  <Icon name="chevronLeft" size={26} />
                </button>
                <button type="button" className="fb-lightbox__nav is-next" onClick={() => step(1)} aria-label="→">
                  <Icon name="chevronRight" size={26} />
                </button>
                <span className="fb-lightbox__count">
                  {index + 1} / {images.length}
                </span>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}

function canHover(): boolean {
  return window.matchMedia?.("(hover: hover)").matches ?? true;
}

/**
 * The reaction total with a hover list of who reacted, fetched the first time it opens
 * and again whenever the counts change.
 */
function ReactionSummary({
  reactions,
  loadReactors,
}: {
  reactions: ReactionCount[];
  loadReactors?: () => Promise<Reactors>;
}) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ key: string; data: Reactors | null; failed: boolean } | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), root);

  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  const top = [...reactions].sort((a, b) => b.count - a.count).slice(0, 3);
  const key = reactions.map((r) => `${r.emoji}${r.count}`).join("");
  const breakdown = reactions.map((r) => `${r.emoji} ${r.count}`).join("   ");

  const show = () => {
    setOpen(true);
    if (!loadReactors || people?.key === key) return;
    setPeople({ key, data: null, failed: false });
    loadReactors()
      .then((data) => setPeople((p) => (p?.key === key ? { key, data, failed: false } : p)))
      .catch(() => setPeople((p) => (p?.key === key ? { key, data: null, failed: true } : p)));
  };

  if (total === 0) return null;
  const current = people?.key === key ? people : null;
  const more = current?.data ? current.data.total - current.data.items.length : 0;

  return (
    <span
      ref={root}
      className="fb-react-sum"
      tabIndex={0}
      aria-label={breakdown}
      // Mouse users get it on hover; a tap on a touch screen toggles it instead.
      onMouseEnter={() => canHover() && show()}
      onMouseLeave={() => canHover() && setOpen(false)}
      onFocus={() => canHover() && show()}
      onBlur={() => setOpen(false)}
      onClick={() => {
        if (!canHover()) (open ? setOpen(false) : show());
      }}
    >
      <span className="fb-react-sum__stack" aria-hidden="true">
        {top.map((r) => (
          <span key={r.emoji}>{r.emoji}</span>
        ))}
      </span>
      <strong aria-hidden="true">{total}</strong>
      {open && (
        <span className="fb-reactors" role="tooltip">
          {!loadReactors || current?.failed ? (
            <span className="fb-reactors__row">{breakdown}</span>
          ) : !current?.data ? (
            <span className="fb-reactors__loading" aria-label={t("auth.wait")} />
          ) : (
            <>
              {current.data.items.map((p, i) => (
                <span key={i} className="fb-reactors__row">
                  <span className="fb-reactors__emoji">{p.emoji}</span>
                  <span className="fb-reactors__name">
                    {p.you ? t("feedback.you") : p.name || t("feedback.formerUser")}
                  </span>
                </span>
              ))}
              {more > 0 && <span className="fb-reactors__more">{fmt(t("feedback.reactorsMore"), { n: more })}</span>}
            </>
          )}
        </span>
      )}
    </span>
  );
}

/** How long the pointer rests on the button before the emotions open, and leaves before they close. */
const HOVER_OPEN_MS = 350;
const HOVER_CLOSE_MS = 300;

/**
 * Facebook-style: an icon button that opens the six emotions on hover (tap on touch screens),
 * and a stack of the most used emotions with the total beside it.
 */
export function ReactionBar({
  reactions,
  mine,
  signedIn,
  onReact,
  loadReactors,
  small,
}: {
  reactions: ReactionCount[];
  mine: Reaction | null;
  signedIn: boolean;
  onReact: (emoji: Reaction) => void;
  loadReactors?: () => Promise<Reactors>;
  small?: boolean;
}) {
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useDismiss(open, () => setOpen(false), root);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (emoji: Reaction) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    onReact(emoji);
  };

  const hover = (next: boolean) => {
    // Touch screens fire mouse events too; there a tap opens the picker instead.
    if (!canHover()) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? HOVER_OPEN_MS : HOVER_CLOSE_MS);
  };

  const size = small ? 16 : 19;

  return (
    <div className={`fb-reacts${small ? " is-small" : ""}`}>
      <div className="fb-pop" ref={root} onMouseEnter={() => signedIn && hover(true)} onMouseLeave={() => signedIn && hover(false)}>
        {signedIn ? (
          <button
            type="button"
            className={`fb-react-btn${mine ? " has-mine" : ""}`}
            // With a reaction already, a click takes it back, as on Facebook.
            onClick={() => {
              if (mine) pick(mine);
              else {
                // Hover may have opened it already; a click should never close it again.
                window.clearTimeout(timer.current);
                setOpen(true);
              }
            }}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={mine ? `${t("feedback.react")}: ${mine}` : t("feedback.react")}
            title={t("feedback.react")}
          >
            {mine ? (
              <span key={mine} className="fb-react-btn__mine">
                {mine}
              </span>
            ) : (
              <Icon name="smile" size={size} />
            )}
          </button>
        ) : (
          <Link to="/auth" className="fb-react-btn" title={t("feedback.loginToReact")} aria-label={t("feedback.loginToReact")}>
            <Icon name="smile" size={size} />
          </Link>
        )}
        {open && (
          <div className="fb-pop__panel fb-react-picker" role="menu" aria-label={t("feedback.react")}>
            {REACTIONS.map((e, i) => (
              <button
                key={e}
                type="button"
                role="menuitemradio"
                aria-checked={mine === e}
                aria-label={e}
                className={mine === e ? "is-mine" : undefined}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => pick(e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <ReactionSummary reactions={reactions} loadReactors={loadReactors} />
    </div>
  );
}
