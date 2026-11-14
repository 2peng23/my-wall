"use client";

import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WallSnapshot } from "@/lib/wall-store";
import { PostItem } from "@/components/post-item";

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
            {posts.map((post) => (
              <PostItem key={post.id} post={post} />
            ))}
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
