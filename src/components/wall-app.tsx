"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MessageComposer } from "@/components/message-composer";
import { PostsFeed } from "@/components/posts-feed";
import { getSupabaseClient } from "@/lib/supabase";
import { createPostsGateway } from "@/lib/posts-gateway";
import { WallStore } from "@/lib/wall-store";

export function WallApp() {
  const [store] = useState(() => {
    const client = getSupabaseClient();
    return new WallStore(client ? createPostsGateway(client) : null);
  });
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    store.start();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void store.refresh();
    };
    const handleOnline = () => {
      void store.refresh();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", store.markOffline);
    if (!navigator.onLine) store.markOffline();
    return () => {
      store.stop();
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", store.markOffline);
    };
  }, [store]);

  return (
    <>
      <main id="main-content" className="wall-main" aria-label="Joel's wall">
        <MessageComposer
          isSharing={state.isSharing}
          isAvailable={state.connection !== "unavailable"}
          error={state.shareError}
          onShare={store.share}
        />
        <PostsFeed
          {...state}
          onRetry={() => void store.retryRead()}
          onLoadOlder={() => void store.loadOlder()}
        />
      </main>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.announcement}
      </p>
    </>
  );
}
