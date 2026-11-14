import { getSupabaseClient } from "@/lib/supabase";

export const PHOTO_BUCKET = "wall-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validatePhoto(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!Object.hasOwn(PHOTO_TYPES, file.type))
    return "That photo wasn't attached. Choose a JPG, PNG, WebP, or GIF image.";
  if (file.size === 0) return "That file is empty. Choose another photo.";
  if (file.size > MAX_PHOTO_BYTES)
    return "That photo wasn't attached. Choose an image smaller than 5 MiB.";
  return null;
}

export function createPhotoPath(file: Pick<File, "type">): string {
  return `posts/${crypto.randomUUID()}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`;
}

export async function validatePhotoContents(
  file: File,
): Promise<string | null> {
  const validationError = validatePhoto(file);
  if (validationError) return validationError;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[index + offset] === byte);
  const supportedSignature =
    (file.type === "image/jpeg" && matches([0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" && matches([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (file.type === "image/gif" &&
      (matches([71, 73, 70, 56, 55, 97]) ||
        matches([71, 73, 70, 56, 57, 97]))) ||
    (file.type === "image/webp" &&
      matches([82, 73, 70, 70]) &&
      matches([87, 69, 66, 80], 8));
  return supportedSignature
    ? null
    : "That file isn't a valid photo. Choose a JPG, PNG, WebP, or GIF image.";
}

export async function uploadPhoto(file: File, path: string): Promise<string> {
  const validationError = await validatePhotoContents(file);
  if (validationError) throw new Error(validationError);
  const client = getSupabaseClient();
  if (!client) throw new Error("Photo sharing is temporarily unavailable.");
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error)
    throw new Error(
      "We couldn't upload your photo. Your message is still here; please try again.",
    );
  return path;
}

export function publicPhotoUrl(path: string): string | null {
  if (!/^posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(path))
    return null;
  const client = getSupabaseClient();
  return (
    client?.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl ?? null
  );
}
