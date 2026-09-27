import type { IconName } from "../../shared/ui/Icon";
import type { TranslationKey, UiLang } from "../../shared/i18n/translations";
import type { FeedbackCategory, FeedbackStatus, Reaction, ReactionCount } from "./feedbackApi";

export const MAX_LEN = 1000;
export const MIN_LEN = 5;

export const CATEGORY: Record<
  FeedbackCategory,
  { icon: IconName; label: TranslationKey; hint: TranslationKey; placeholder: TranslationKey }
> = {
  idea: { icon: "bulb", label: "feedback.cat.idea", hint: "feedback.cat.ideaHint", placeholder: "feedback.ph.idea" },
  bug: { icon: "bug", label: "feedback.cat.bug", hint: "feedback.cat.bugHint", placeholder: "feedback.ph.bug" },
  content: { icon: "book", label: "feedback.cat.content", hint: "feedback.cat.contentHint", placeholder: "feedback.ph.content" },
  other: { icon: "message", label: "feedback.cat.other", hint: "feedback.cat.otherHint", placeholder: "feedback.ph.other" },
};

export const STATUS: Record<FeedbackStatus, { icon: IconName; label: TranslationKey }> = {
  open: { icon: "eye", label: "feedback.status.open" },
  planned: { icon: "clock", label: "feedback.status.planned" },
  done: { icon: "check", label: "feedback.status.done" },
};

export const LOCALE: Record<UiLang, string> = { vi: "vi-VN", ja: "ja-JP", en: "en-GB" };

export function timeAgo(iso: string, lang: UiLang): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
  const sec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = sec;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return unit === "second" ? rtf.format(0, "second") : rtf.format(value, unit);
    value = Math.round(value / size);
  }
  return rtf.format(value, "year");
}

/** What the counts become after the viewer clicks `emoji`, before the server answers. */
export function applyReaction(
  reactions: ReactionCount[],
  mine: Reaction | null,
  emoji: Reaction,
): { reactions: ReactionCount[]; myReaction: Reaction | null } {
  const next = new Map(reactions.map((r) => [r.emoji, r.count]));
  if (mine) next.set(mine, (next.get(mine) ?? 1) - 1);
  const myReaction = mine === emoji ? null : emoji;
  if (myReaction) next.set(myReaction, (next.get(myReaction) ?? 0) + 1);
  const order = reactions.map((r) => r.emoji);
  if (myReaction && !order.includes(myReaction)) order.push(myReaction);
  return {
    reactions: order.map((e) => ({ emoji: e, count: next.get(e) ?? 0 })).filter((r) => r.count > 0),
    myReaction,
  };
}
