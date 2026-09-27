/** Side of the square picture sent to the server. */
const AVATAR_SIZE = 256;
/** Phone photos are several MB; anything past this is unlikely to be a picture worth decoding. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export class AvatarImageError extends Error {
  constructor(readonly reason: "type" | "size" | "decode") {
    super(reason);
  }
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError("decode"));
    };
    img.src = url;
  });
}

/** Crops the middle square of a picked image and shrinks it to a small JPEG data URL. */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("type");
  if (file.size > MAX_SOURCE_BYTES) throw new AvatarImageError("size");

  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new AvatarImageError("decode");

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarImageError("decode");

  // Transparent PNGs would turn black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return canvas.toDataURL("image/jpeg", 0.88);
}
