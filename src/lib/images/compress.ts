import imageCompression from "browser-image-compression";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor() {
    super("That image is over 5 MB. Please choose a smaller one.");
  }
}

/** Browser-side: square-ish avatar, WebP, <= 512px, ~100 KB. */
export async function compressAvatar(file: File): Promise<File> {
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageTooLargeError();
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const out = await imageCompression(file, {
    maxWidthOrHeight: 512,
    maxSizeMB: 0.1,
    fileType: "image/webp",
    useWebWorker: true,
    initialQuality: 0.85,
  });
  return new File([out], "avatar.webp", { type: "image/webp" });
}
