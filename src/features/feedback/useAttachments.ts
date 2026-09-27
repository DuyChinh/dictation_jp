import { useEffect, useRef, useState } from "react";
import { AvatarImageError, loadImage } from "../auth/avatarImage";
import { uploadFeedbackImage } from "./feedbackApi";

/** Longest side of an attached picture; plenty for a screenshot, small enough to upload fast. */
const MAX_SIDE = 1400;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Stays under the server's cap once base64-encoded. */
const MAX_DATA_URL_CHARS = 900_000;

async function shrink(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("type");
  if (file.size > MAX_SOURCE_BYTES) throw new AvatarImageError("size");
  const img = await loadImage(file);
  let side = MAX_SIDE;
  for (const quality of [0.85, 0.75, 0.65]) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarImageError("decode");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_DATA_URL_CHARS) return url;
    side = Math.round(side * 0.8);
  }
  throw new AvatarImageError("size");
}

export type Attachment = {
  key: string;
  /** Shown while uploading: a local preview. */
  preview: string;
  url: string | null;
  status: "uploading" | "done" | "error";
};

let nextKey = 0;

export type UploadImage = (dataUrl: string) => Promise<{ url: string }>;

/**
 * Pictures picked for a post or reply, uploaded as soon as they are picked.
 * `upload` defaults to the learner endpoint; the admin area passes its own.
 */
export function useAttachments(max: number, initial: string[] = [], upload: UploadImage = uploadFeedbackImage) {
  const [items, setItems] = useState<Attachment[]>(() =>
    initial.map((url) => ({ key: `a${nextKey++}`, preview: url, url, status: "done" as const })),
  );
  const [problem, setProblem] = useState<"size" | "type" | "count" | "upload" | null>(null);
  const live = useRef(true);

  // Set on every mount: StrictMode unmounts and remounts once in development.
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const add = (files: FileList | File[]) => {
    const list = Array.from(files);
    const room = max - items.length;
    setProblem(list.length > room ? "count" : null);
    for (const file of list.slice(0, Math.max(0, room))) {
      const key = `a${nextKey++}`;
      const preview = URL.createObjectURL(file);
      setItems((prev) => [...prev, { key, preview, url: null, status: "uploading" }]);
      shrink(file)
        .then((dataUrl) => upload(dataUrl))
        .then(({ url }) => {
          if (!live.current) return;
          setItems((prev) => prev.map((a) => (a.key === key ? { ...a, url, status: "done" } : a)));
        })
        .catch((err) => {
          if (!live.current) return;
          setProblem(err instanceof AvatarImageError ? (err.reason === "size" ? "size" : "type") : "upload");
          setItems((prev) => prev.filter((a) => a.key !== key));
          URL.revokeObjectURL(preview);
        });
    }
  };

  const remove = (key: string) => {
    setItems((prev) => prev.filter((a) => a.key !== key));
    setProblem(null);
  };

  const reset = (urls: string[] = []) => {
    setItems(urls.map((url) => ({ key: `a${nextKey++}`, preview: url, url, status: "done" as const })));
    setProblem(null);
  };

  return {
    items,
    urls: items.filter((a) => a.status === "done" && a.url).map((a) => a.url!),
    uploading: items.some((a) => a.status === "uploading"),
    full: items.length >= max,
    problem,
    add,
    remove,
    reset,
  };
}

export type Attachments = ReturnType<typeof useAttachments>;
