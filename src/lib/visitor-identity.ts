export const VISITOR_STORAGE_KEY = "mywall.visitor.v1";
export const MAX_NAME_LENGTH = 48;

export type PostingIdentity = { visitorId: string; name: string };
export type BrowserIdentity = { visitorId: string | null; name: string };
const EMPTY_IDENTITY: BrowserIdentity = { visitorId: null, name: "" };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorIdentifier(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function visitorLabel(identifier: string | null): string {
  return identifier
    ? `Visitor #${identifier.replaceAll("-", "").slice(0, 8).toUpperCase()}`
    : "Visitor";
}

export function validateName(name: string): string | null {
  if (Array.from(name).length > MAX_NAME_LENGTH)
    return "Use 48 characters or fewer for your name.";
  if (/\p{Cc}/u.test(name))
    return "Keep your name on one line, without control characters.";
  return null;
}

export function readIdentity(
  storage: Pick<Storage, "getItem">,
): BrowserIdentity | null {
  try {
    const saved = JSON.parse(storage.getItem(VISITOR_STORAGE_KEY) ?? "null");
    if (
      !saved ||
      typeof saved.visitorId !== "string" ||
      !isVisitorIdentifier(saved.visitorId)
    )
      return null;
    const name =
      typeof saved.name === "string" && !validateName(saved.name)
        ? saved.name
        : "";
    return { visitorId: saved.visitorId.toLowerCase(), name };
  } catch {
    return null;
  }
}

/** Local preference, not authentication or a device fingerprint. */
export class VisitorIdentityStore {
  private snapshot: BrowserIdentity = EMPTY_IDENTITY;
  private listeners = new Set<() => void>();
  private storage: Storage | null = null;

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => EMPTY_IDENTITY;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(identity: BrowserIdentity) {
    this.snapshot = identity;
    this.listeners.forEach((listener) => listener());
  }

  initialize(storage: Storage | null) {
    this.storage = storage;
    const saved = storage ? readIdentity(storage) : null;
    this.update(
      saved ?? {
        visitorId: this.snapshot.visitorId ?? crypto.randomUUID(),
        name: this.snapshot.name,
      },
    );
    this.persist();
  }

  private persist() {
    try {
      this.storage?.setItem(VISITOR_STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      /* Posting remains usable if browser storage is blocked. */
    }
  }

  setName = (name: string) => {
    this.update({ ...this.snapshot, name });
    if (!validateName(name)) this.persist();
  };

  synchronize = () => {
    const saved = this.storage ? readIdentity(this.storage) : null;
    if (saved) this.update(saved);
  };
}
