import { describe, expect, it } from "vitest";
import {
  countCharacters,
  mergePosts,
  matchesSubmission,
  type PendingPost,
  validateMessage,
  type Post,
} from "@/lib/posts";

const post = (id: string, created_at: string): Post => ({
  id,
  created_at,
  content: id,
  author_name: "Visitor",
  visitor_id: null,
  image_path: null,
});

describe("message validation", () => {
  it("rejects empty and all ECMAScript whitespace", () => {
    for (const message of [
      "",
      " \t\n\r",
      "\u00a0\u1680\u2000\u2028\u202f\u205f\u3000\ufeff",
    ])
      expect(validateMessage(message)).not.toBeNull();
  });
  it("counts Unicode code points without splitting emoji", () => {
    expect(countCharacters("hello 👋")).toBe(7);
    expect(validateMessage("🌱".repeat(280))).toBeNull();
    expect(validateMessage("🌱".repeat(281))).not.toBeNull();
  });
  it("allows multiline content and catches oversized pastes", () => {
    expect(validateMessage("Hello\nworld")).toBeNull();
    expect(validateMessage("a".repeat(281))).not.toBeNull();
  });
});

describe("feed reconciliation", () => {
  it("preserves database microsecond ordering within one JavaScript millisecond", () => {
    expect(
      mergePosts(
        [],
        [
          post("z", "2026-11-15T00:00:00.123100+00:00"),
          post("a", "2026-11-15T00:00:00.123900+00:00"),
        ],
      ).map((entry) => entry.id),
    ).toEqual(["a", "z"]);
  });
  it("merges out-of-order events, deduplicates identifiers, and breaks ties", () => {
    const result = mergePosts(
      [post("a", "2026-11-15T00:00:00Z"), post("c", "2026-11-15T00:00:01Z")],
      [post("b", "2026-11-15T00:00:01Z"), post("a", "2026-11-15T00:00:00Z")],
    );
    expect(result.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });
});

describe("submission identity", () => {
  it("accepts only the exact committed submission, independent of the server timestamp", () => {
    const submission: PendingPost = {
      id: "same-id",
      content: "Hello",
      author_name: null,
      visitor_id: "same-visitor",
      image_path: null,
    };
    const saved: Post = { ...submission, created_at: "2026-11-15T00:00:00Z" };
    expect(matchesSubmission(saved, submission)).toBe(true);
    for (const [field, value] of Object.entries({
      id: "other-id",
      content: "Other content",
      author_name: "Other name",
      visitor_id: "other-visitor",
      image_path: "other-photo",
    }))
      expect(matchesSubmission({ ...saved, [field]: value }, submission)).toBe(
        false,
      );
  });
});
