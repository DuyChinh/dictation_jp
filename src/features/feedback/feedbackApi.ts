import { apiFetch } from "../../shared/api/client";

export const FEEDBACK_CATEGORIES = ["idea", "bug", "content", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = "open" | "planned" | "done";
export type FeedbackSort = "new" | "top";

/** Same list and order as backend/src/models/Feedback.ts. */
export const REACTIONS = ["❤️", "😂", "😮", "😢", "🎉", "🔥"] as const;
export type Reaction = (typeof REACTIONS)[number];
export type ReactionCount = { emoji: Reaction; count: number };

export const MAX_POST_IMAGES = 4;
export const MAX_REPLY_IMAGES = 2;

export type FeedbackAuthor = { kind: "user" | "team"; name: string; avatar: string | null };

export type FeedbackItem = {
  id: string;
  /** "team" posts come from the Motto team via the admin area. */
  author: FeedbackAuthor;
  category: FeedbackCategory;
  body: string;
  images: string[];
  status: FeedbackStatus;
  pinned: boolean;
  adminReply: string | null;
  repliedAt: string | null;
  /** Set once the author has changed the post. */
  editedAt: string | null;
  likes: number;
  liked: boolean;
  reactions: ReactionCount[];
  myReaction: Reaction | null;
  replyCount: number;
  mine: boolean;
  createdAt: string;
};

export type FeedbackReply = {
  id: string;
  feedbackId: string;
  author: FeedbackAuthor;
  body: string;
  images: string[];
  editedAt: string | null;
  reactions: ReactionCount[];
  myReaction: Reaction | null;
  mine: boolean;
  createdAt: string;
};

type ReactionResult = { reactions: ReactionCount[]; myReaction: Reaction | null };

/** Who reacted, for the hover list; `total` counts people beyond the names sent. */
export type Reactors = { items: Array<{ emoji: Reaction; name: string; you: boolean }>; total: number };

export type FeedbackPage = {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; planned: number; done: number };
};

/**
 * Fills in fields an older server (or an older post) leaves out, so the board never
 * trips over a missing list.
 */
function normalizePost(p: FeedbackItem): FeedbackItem {
  return {
    ...p,
    images: p.images ?? [],
    reactions: p.reactions ?? [],
    myReaction: p.myReaction ?? null,
    replyCount: p.replyCount ?? 0,
    editedAt: p.editedAt ?? null,
  };
}

function normalizeReply(r: FeedbackReply): FeedbackReply {
  return { ...r, images: r.images ?? [], reactions: r.reactions ?? [], myReaction: r.myReaction ?? null };
}

function normalizeReactions(r: ReactionResult): ReactionResult {
  return { reactions: r.reactions ?? [], myReaction: r.myReaction ?? null };
}

/** Sends the learner's token when there is one, so the board knows what they liked and wrote. */
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function listFeedback(q: { sort: FeedbackSort; category: FeedbackCategory | ""; page: number }) {
  const params = new URLSearchParams({ sort: q.sort, page: String(q.page), limit: "10" });
  if (q.category) params.set("category", q.category);
  return apiFetch<FeedbackPage>(`/api/feedback?${params}`, { headers: authHeaders() }).then((d) => ({
    ...d,
    items: d.items.map(normalizePost),
  }));
}

export function postFeedback(post: { category: FeedbackCategory; body: string; images: string[] }) {
  return apiFetch<{ item: FeedbackItem }>("/api/feedback", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(post),
  }).then((d) => ({ item: normalizePost(d.item) }));
}

/** Takes a data URL of an already shrunk picture; returns where it is stored. */
export function uploadFeedbackImage(image: string) {
  return apiFetch<{ url: string }>("/api/feedback/images", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ image }),
  });
}

export function reactToFeedback(id: string, emoji: Reaction) {
  return apiFetch<ReactionResult>(`/api/feedback/${id}/react`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ emoji }),
  }).then(normalizeReactions);
}

export function listPostReactors(id: string) {
  return apiFetch<Reactors>(`/api/feedback/${id}/reactions`, { headers: authHeaders() });
}

export function listReplyReactors(id: string) {
  return apiFetch<Reactors>(`/api/feedback/replies/${id}/reactions`, { headers: authHeaders() });
}

export function listReplies(feedbackId: string) {
  return apiFetch<{ items: FeedbackReply[] }>(`/api/feedback/${feedbackId}/replies`, { headers: authHeaders() }).then(
    (d) => ({ items: d.items.map(normalizeReply) }),
  );
}

export function postReply(feedbackId: string, reply: { body: string; images: string[] }) {
  return apiFetch<{ item: FeedbackReply }>(`/api/feedback/${feedbackId}/replies`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(reply),
  }).then((d) => ({ item: normalizeReply(d.item) }));
}

export function updateReply(id: string, reply: { body: string; images: string[] }) {
  return apiFetch<{ item: FeedbackReply }>(`/api/feedback/replies/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(reply),
  }).then((d) => ({ item: normalizeReply(d.item) }));
}

export function deleteReply(id: string) {
  return apiFetch<{ deleted: number }>(`/api/feedback/replies/${id}`, { method: "DELETE", headers: authHeaders() });
}

export function reactToReply(id: string, emoji: Reaction) {
  return apiFetch<ReactionResult>(`/api/feedback/replies/${id}/react`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ emoji }),
  }).then(normalizeReactions);
}

export function updateFeedback(id: string, patch: { category: FeedbackCategory; body: string; images: string[] }) {
  return apiFetch<{ item: FeedbackItem }>(`/api/feedback/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  }).then((d) => ({ item: normalizePost(d.item) }));
}

export function toggleFeedbackLike(id: string) {
  return apiFetch<{ likes: number; liked: boolean }>(`/api/feedback/${id}/like`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export function deleteFeedback(id: string) {
  return apiFetch<{ deleted: number }>(`/api/feedback/${id}`, { method: "DELETE", headers: authHeaders() });
}
