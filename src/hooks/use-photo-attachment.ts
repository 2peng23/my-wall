"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPhotoPath,
  uploadPhoto,
  validatePhotoContents,
} from "@/lib/photos";

type PhotoAttachment = { file: File; preview: string };
type PhotoStatus = "idle" | "checking" | "uploading";

export function usePhotoAttachment() {
  const [photo, setPhoto] = useState<PhotoAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PhotoStatus>("idle");
  const selectionSequence = useRef(0);
  const previewReference = useRef<string | null>(null);
  const uploadedPhoto = useRef<{ file: File; path: string } | null>(null);

  useEffect(
    () => () => {
      selectionSequence.current += 1;
      if (previewReference.current)
        URL.revokeObjectURL(previewReference.current);
    },
    [],
  );

  function clearPhoto() {
    selectionSequence.current += 1;
    if (previewReference.current) URL.revokeObjectURL(previewReference.current);
    previewReference.current = null;
    uploadedPhoto.current = null;
    setPhoto(null);
    setError(null);
    setStatus("idle");
  }

  async function selectPhoto(file: File) {
    clearPhoto();
    const selection = selectionSequence.current;
    setStatus("checking");
    let preview: string | undefined;
    try {
      const validationError = await validatePhotoContents(file);
      if (validationError) throw new Error(validationError);
      if (selection !== selectionSequence.current) return;
      preview = URL.createObjectURL(file);
      const image = new window.Image();
      image.src = preview;
      await image.decode();
      if (selection !== selectionSequence.current) return;
      previewReference.current = preview;
      setPhoto({ file, preview });
      preview = undefined;
    } catch (error) {
      if (selection === selectionSequence.current)
        setError(
          error instanceof Error && error.name !== "EncodingError"
            ? error.message
            : "That photo couldn't be opened. Choose another image.",
        );
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      if (selection === selectionSequence.current) setStatus("idle");
    }
  }

  async function uploadSelectedPhoto(): Promise<string | null | false> {
    setError(null);
    if (!photo) return null;
    if (uploadedPhoto.current?.file === photo.file)
      return uploadedPhoto.current.path;
    const selection = selectionSequence.current;
    setStatus("uploading");
    try {
      const path = await uploadPhoto(photo.file, createPhotoPath(photo.file));
      if (selection !== selectionSequence.current) return false;
      uploadedPhoto.current = { file: photo.file, path };
      return path;
    } catch (error) {
      if (selection === selectionSequence.current)
        setError(
          error instanceof Error
            ? error.message
            : "We couldn't upload your photo. Please try again.",
        );
      return false;
    } finally {
      if (selection === selectionSequence.current) setStatus("idle");
    }
  }

  return { photo, error, status, clearPhoto, selectPhoto, uploadSelectedPhoto };
}
