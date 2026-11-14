"use client";

import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  countCharacters,
  MAX_MESSAGE_LENGTH,
  validateMessage,
} from "@/lib/posts";
import { PHOTO_ACCEPT } from "@/lib/photos";
import { usePhotoAttachment } from "@/hooks/use-photo-attachment";
import {
  validateName,
  visitorLabel,
  type PostingIdentity,
} from "@/lib/visitor-identity";
import { useVisitorIdentity } from "@/hooks/use-visitor-identity";

type MessageComposerProps = {
  isSharing: boolean;
  isAvailable: boolean;
  error: string | null;
  onShare: (
    content: string,
    identity: PostingIdentity,
    imagePath?: string | null,
  ) => Promise<boolean>;
};

export function MessageComposer({
  isSharing,
  isAvailable,
  error,
  onShare,
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const { identity, setName } = useVisitorIdentity();
  const attachment = usePhotoAttachment();
  const selectedPhoto = attachment.photo;
  const photoError = attachment.error;
  const isUploading = attachment.status === "uploading";
  const isCheckingPhoto = attachment.status === "checking";
  const submissionLock = useRef(false);
  const fileInputReference = useRef<HTMLInputElement>(null);
  const textareaReference = useRef<HTMLTextAreaElement>(null);
  const messageLength = countCharacters(message);
  const remainingCharacters = MAX_MESSAGE_LENGTH - messageLength;
  const nameError = validateName(identity.name);
  const isBusy = isSharing || isUploading || isCheckingPhoto;
  const canShare =
    isAvailable &&
    !isBusy &&
    !!identity.visitorId &&
    !validateMessage(message) &&
    !nameError;

  function removePhoto() {
    attachment.clearPhoto();
    if (fileInputReference.current) fileInputReference.current.value = "";
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canShare || !identity.visitorId || submissionLock.current) return;
    submissionLock.current = true;
    try {
      const photoPath = await attachment.uploadSelectedPhoto();
      if (photoPath === false) return;
      if (
        await onShare(
          message,
          { visitorId: identity.visitorId, name: identity.name },
          photoPath,
        )
      ) {
        setMessage("");
        removePhoto();
        requestAnimationFrame(() => textareaReference.current?.focus());
      }
    } finally {
      submissionLock.current = false;
    }
  }

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <form onSubmit={handleSubmission} aria-busy={isBusy}>
        <label htmlFor="message" id="composer-title" className="composer-label">
          Leave a message
        </label>
        <Textarea
          id="message"
          ref={textareaReference}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key === "Enter" &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="What's on your mind?"
          className="message-input"
          required
          disabled={isBusy || !isAvailable}
          aria-invalid={remainingCharacters < 0 || undefined}
          aria-describedby={`character-count${remainingCharacters < 0 ? " character-error" : ""}${error ? " share-error" : ""}`}
        />
        <div className="composer-meta">
          <input
            ref={fileInputReference}
            type="file"
            id="photo"
            hidden
            accept={PHOTO_ACCEPT}
            disabled={isBusy || !isAvailable}
            aria-label="Choose a photo"
            aria-describedby={photoError ? "photo-error" : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void attachment.selectPhoto(file);
            }}
          />
          <button
            type="button"
            className="attach-button"
            disabled={isBusy || !isAvailable}
            onClick={() => fileInputReference.current?.click()}
            title="JPG, PNG, WebP or GIF, up to 5 MiB"
          >
            <ImagePlus size={16} aria-hidden="true" />
            {selectedPhoto ? "Change photo" : "Add photo"}
          </button>
          <span
            id="character-count"
            className={`character-count${remainingCharacters < 0 ? " over-limit" : ""}`}
          >
            {messageLength} / {MAX_MESSAGE_LENGTH}
          </span>
        </div>
        {remainingCharacters < 0 && (
          <p id="character-error" className="field-error">
            {Math.abs(remainingCharacters)} too many characters. Keep it to 280.
          </p>
        )}
        {selectedPhoto && (
          <div className="attachment-preview">
            <Image
              src={selectedPhoto.preview}
              alt="Selected photo preview"
              width={80}
              height={64}
              unoptimized
            />
            <span>{selectedPhoto.file.name}</span>
            <button
              type="button"
              onClick={removePhoto}
              disabled={isBusy}
              aria-label="Remove photo"
            >
              Remove
            </button>
          </div>
        )}
        {photoError && (
          <p id="photo-error" role="alert" className="field-error">
            {photoError}
          </p>
        )}
        {error && (
          <p id="share-error" role="alert" className="field-error share-error">
            {error}
          </p>
        )}
        <div className="composer-actions">
          <div className="name-field">
            <label htmlFor="author-name">
              Name <span>(optional)</span>
            </label>
            <input
              id="author-name"
              type="text"
              value={identity.name}
              onChange={(event) => setName(event.target.value)}
              placeholder={visitorLabel(identity.visitorId)}
              autoComplete="nickname"
              disabled={isBusy || !isAvailable}
              aria-invalid={!!nameError || undefined}
              aria-describedby={nameError ? "name-error" : undefined}
            />
          </div>
          <Button type="submit" disabled={!canShare} className="share-button">
            {isCheckingPhoto
              ? "Checking…"
              : isBusy
                ? isUploading
                  ? "Uploading…"
                  : "Sharing…"
                : "Share"}
          </Button>
        </div>
        {nameError && (
          <p id="name-error" className="field-error">
            {nameError}
          </p>
        )}
      </form>
    </section>
  );
}
