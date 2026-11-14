import { describe, expect, it } from "vitest";
import {
  readIdentity,
  validateName,
  visitorLabel,
  VisitorIdentityStore,
  VISITOR_STORAGE_KEY,
} from "@/lib/visitor-identity";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("browser visitor identity", () => {
  it("keeps the same random identifier after reloads and in another tab", () => {
    const storage = memoryStorage();
    const firstVisit = new VisitorIdentityStore();
    firstVisit.initialize(storage);
    const identifier = firstVisit.getSnapshot().visitorId;
    const nextVisit = new VisitorIdentityStore();
    nextVisit.initialize(storage);
    expect(nextVisit.getSnapshot().visitorId).toBe(identifier);
    expect(visitorLabel(identifier)).toMatch(/^Visitor #[0-9A-F]{8}$/);
  });

  it("assigns different browser storage a different identifier", () => {
    const first = new VisitorIdentityStore();
    const second = new VisitorIdentityStore();
    first.initialize(memoryStorage());
    second.initialize(memoryStorage());
    expect(first.getSnapshot().visitorId).not.toBe(
      second.getSnapshot().visitorId,
    );
  });

  it("remembers an optional name and returns to the same anonymous label when cleared", () => {
    const storage = memoryStorage();
    const first = new VisitorIdentityStore();
    first.initialize(storage);
    const identifier = first.getSnapshot().visitorId;
    first.setName("Nadia Ali");
    const nextVisit = new VisitorIdentityStore();
    nextVisit.initialize(storage);
    expect(nextVisit.getSnapshot()).toEqual({
      visitorId: identifier,
      name: "Nadia Ali",
    });
    nextVisit.setName("");
    expect(readIdentity(storage)).toEqual({ visitorId: identifier, name: "" });
  });

  it("recovers from corrupt storage without accepting an arbitrary identifier", () => {
    const storage = memoryStorage();
    storage.setItem(VISITOR_STORAGE_KEY, '{"visitorId":"not-a-uuid"}');
    const store = new VisitorIdentityStore();
    store.initialize(storage);
    expect(visitorLabel(store.getSnapshot().visitorId)).toMatch(
      /^Visitor #[0-9A-F]{8}$/,
    );
    storage.setItem(VISITOR_STORAGE_KEY, "malformed");
    expect(readIdentity(storage)).toBeNull();
  });

  it("stays usable for the current tab if persistence is blocked", () => {
    const store = new VisitorIdentityStore();
    store.initialize(null);
    const identifier = store.getSnapshot().visitorId;
    store.initialize(null);
    expect(store.getSnapshot().visitorId).toBe(identifier);
  });

  it("synchronizes name preferences across tabs", () => {
    const storage = memoryStorage();
    const first = new VisitorIdentityStore();
    const second = new VisitorIdentityStore();
    first.initialize(storage);
    second.initialize(storage);
    first.setName("Alex");
    second.synchronize();
    expect(second.getSnapshot()).toEqual(first.getSnapshot());
  });

  it("validates Unicode length and rejects multiline/control-character names", () => {
    expect(validateName("")).toBeNull();
    expect(validateName("🌱".repeat(48))).toBeNull();
    expect(validateName("🌱".repeat(49))).not.toBeNull();
    expect(validateName("Alex\nSmith")).not.toBeNull();
    expect(validateName("Alex\u0000Smith")).not.toBeNull();
  });
});
