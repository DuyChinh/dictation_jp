import { useState } from "react";
import { parseVideoUrl, sameVideo, type FeedbackVideo } from "./videoLinks";

export const MAX_POST_VIDEOS = 2;

export type VideoProblem = "bad" | "full" | "dup";

/** Videos being attached to a post, plus whether the link box is showing. */
export function useVideoLinks(initial: FeedbackVideo[] = []) {
  const [videos, setVideos] = useState<FeedbackVideo[]>(initial);
  const [open, setOpen] = useState(false);

  /** Adds the pasted link; returns what was wrong with it, or null once added. */
  const add = (url: string): VideoProblem | null => {
    const video = parseVideoUrl(url);
    if (!video) return "bad";
    if (videos.some((v) => sameVideo(v, video))) return "dup";
    if (videos.length >= MAX_POST_VIDEOS) return "full";
    setVideos((prev) => [...prev, video]);
    return null;
  };

  const remove = (video: FeedbackVideo) => setVideos((prev) => prev.filter((v) => !sameVideo(v, video)));

  const reset = (next: FeedbackVideo[] = []) => {
    setVideos(next);
    setOpen(false);
  };

  return { videos, open, setOpen, add, remove, reset, full: videos.length >= MAX_POST_VIDEOS };
}

export type VideoLinks = ReturnType<typeof useVideoLinks>;
