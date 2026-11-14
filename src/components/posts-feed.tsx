"use client";

import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WallSnapshot } from "@/lib/wall-store";
import Image from "next/image";
import { publicPhotoUrl } from "@/lib/photos";
import { postAuthorLabel } from "@/lib/posts";

type PostsFeedProps = Pick<
  WallSnapshot,
  | "posts"
  | "isLoading"
  | "isLoadingOlder"
  | "hasMore"
  | "readError"
  | "connection"
> & {
  onRetry: () => void;
  onLoadOlder: () => void;
};

export function PostsFeed({
  posts,
  isLoading,
  isLoadingOlder,
  hasMore,
  readError,
  connection,
  onRetry,
  onLoadOlder,
}: PostsFeedProps) {
  const scrollReference = useRef<HTMLDivElement>(null);
  const previousFirstPost = useRef<string | undefined>(undefined);
  const scrollPosition = useRef(0);
  const [showLatestButton, setShowLatestButton] = useState(false);

  useLayoutEffect(() => {
    const scroller = scrollReference.current;
    const previousIdentifier = previousFirstPost.current;
    if (scroller && previousIdentifier && previousIdentifier !== posts[0]?.id) {
      const previousIndex = posts.findIndex(
        (post) => post.id === previousIdentifier,
      );
      if (previousIndex > 0 && scrollPosition.current > 2) {
        const previousRow = scroller.querySelector<HTMLElement>(
          `[data-post-id="${previousIdentifier}"]`,
        );
        const list = scroller.querySelector(".posts-list");
        if (previousRow && list) {
          // Keep the message being read in place when newer messages arrive.
          scroller.scrollTop =
            scrollPosition.current +
            previousRow.getBoundingClientRect().top -
            list.getBoundingClientRect().top;
        }
      } else if (scrollPosition.current <= 2) scroller.scrollTop = 0;
    }
    previousFirstPost.current = posts[0]?.id;
    if (scroller) scrollPosition.current = scroller.scrollTop;
  }, [posts]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scroller = event.currentTarget;
    scrollPosition.current = scroller.scrollTop;
    setShowLatestButton(
      scroller.scrollTop > Math.min(300, scroller.clientHeight),
    );
    if (
      scroller.scrollTop > 0 &&
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
        160 &&
      hasMore &&
      !isLoadingOlder &&
      !readError
    )
      onLoadOlder();
  }

  function scrollToLatest() {
    const scroller = scrollReference.current;
    if (!scroller) return;
    scroller.focus({ preventScroll: true });
    scroller.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <section className="feed-section" aria-labelledby="feed-title">
      <div className="feed-heading">
        <h2 id="feed-title" className="feed-title">
          Messages
        </h2>
        {showLatestButton && (
          <button
            type="button"
            className="latest-button"
            onClick={scrollToLatest}
          >
            <ArrowUp size={14} aria-hidden="true" /> Back to latest
          </button>
        )}
      </div>
      <div
        ref={scrollReference}
        className="messages-scroll"
        role="region"
        aria-label="Message history"
        tabIndex={0}
        onScroll={handleScroll}
      >
        {readError && (
          <div className="read-error" role="alert">
            <p>{readError}</p>
            {connection !== "unavailable" && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
        {isLoading ? (
          <p className="feed-loading" role="status">
            Loading messages…
          </p>
        ) : !posts.length && !readError ? (
          <p className="empty-wall">No messages yet.</p>
        ) : posts.length > 0 ? (
          <ol className="posts-list" aria-label="Messages, newest first">
            {posts.map((post) => {
              const author = postAuthorLabel(post);
              const photoUrl = post.image_path
                ? publicPhotoUrl(post.image_path)
                : null;
              const initials = post.author_name
                ? post.author_name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => Array.from(part)[0])
                    .join("")
                    .toUpperCase()
                : post.visitor_id
                  ? post.visitor_id.slice(0, 2).toUpperCase()
                  : "V";
              return (
                <li
                  key={post.id}
                  className="post-row"
                  data-post-id={post.id}
                  data-visitor-id={post.visitor_id ?? ""}
                >
                  <article aria-labelledby={`author-${post.id}`}>
                    <div className="post-avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="post-body">
                      <div className="post-byline">
                        <h3 id={`author-${post.id}`}>{author}</h3>
                        <time
                          dateTime={post.created_at}
                          title={new Date(post.created_at).toLocaleString()}
                        >
                          {new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(post.created_at))}
                        </time>
                      </div>
                      <p className="post-message">{post.content}</p>
                      {photoUrl && (
                        <a
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="post-photo-link"
                          aria-label={`Open full-size photo from ${author}`}
                        >
                          <Image
                            src={photoUrl}
                            width={800}
                            height={600}
                            unoptimized
                            alt="Photo shared with this message"
                            className="post-photo"
                          />
                        </a>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        ) : null}
        {hasMore && (
          <div className="load-older">
            <Button
              variant="outline"
              onClick={onLoadOlder}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
