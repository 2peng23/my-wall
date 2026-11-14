"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  VisitorIdentityStore,
  VISITOR_STORAGE_KEY,
} from "@/lib/visitor-identity";

export function useVisitorIdentity() {
  const [store] = useState(() => new VisitorIdentityStore());
  const identity = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Use a tab-local identity when storage is unavailable. */
    }
    store.initialize(storage);
    const synchronize = (event: StorageEvent) => {
      if (event.key === VISITOR_STORAGE_KEY) store.synchronize();
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [store]);

  return { identity, setName: store.setName };
}
