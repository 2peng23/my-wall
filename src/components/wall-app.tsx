"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ProfileSidebar } from "@/components/profile-sidebar";
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
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to the wall
      </a>
      <header className="site-header">
        <div className="header-inner">
          <span className="wordmark">
            <Image
              src="/my-wall-logo.png"
              alt=""
              width={40}
              height={40}
              className="wordmark-logo"
            />
            wall<span>.</span>
          </span>
        </div>
      </header>
      <div className="page-layout">
        <ProfileSidebar />
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
      </div>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.announcement}
      </p>
    </div>
  );
}
