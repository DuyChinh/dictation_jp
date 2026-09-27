/** Same shape and id rules as backend/src/shared/videoLinks.ts. */
export type VideoProvider = "youtube" | "drive";
export type FeedbackVideo = { provider: VideoProvider; id: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{20,120}$/;

/** Turns a pasted YouTube or Google Drive link into a video, or null when it is neither. */
export function parseVideoUrl(input: string): FeedbackVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtube(parts[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v"));
    if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) return youtube(parts[1]);
    return null;
  }
  if (host === "drive.google.com") {
    // /file/d/<id>/view, /open?id=<id>, /uc?id=<id>
    const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : url.searchParams.get("id");
    return id && DRIVE_ID.test(id) ? { provider: "drive", id } : null;
  }
  return null;
}

function youtube(id: string | null | undefined): FeedbackVideo | null {
  return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
}

export function videoEmbedUrl(v: FeedbackVideo): string {
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
    : `https://drive.google.com/file/d/${v.id}/preview`;
}

/** A still for the play facade; Drive only has one for files shared publicly. */
export function videoThumbUrl(v: FeedbackVideo): string {
  return v.provider === "youtube"
    ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
    : `https://drive.google.com/thumbnail?id=${v.id}&sz=w640`;
}

export function sameVideo(a: FeedbackVideo, b: FeedbackVideo): boolean {
  return a.provider === b.provider && a.id === b.id;
}
