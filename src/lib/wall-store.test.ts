import { describe, expect, it, vi } from "vitest";
import {
  PostRequestError,
  PAGE_SIZE,
  type ConnectionStatus,
  type PendingPost,
  type Post,
  type PostPage,
  type PostsGateway,
} from "@/lib/posts";
import { WallStore } from "@/lib/wall-store";

const defaultIdentity = {
  visitorId: "a717c920-8634-45dd-b940-23c04bf047d5",
  name: "",
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function savedPost(
  submission: Pick<PendingPost, "id" | "content" | "image_path"> &
    Partial<PendingPost>,
  timestamp = "2026-11-15T00:00:00Z",
): Post {
  return {
    visitor_id: defaultIdentity.visitorId,
    author_name: null,
    ...submission,
    created_at: timestamp,
  };
}

function fixture() {
  let onPost: (post: Post) => void = () => {};
  let onStatus: (status: ConnectionStatus) => void = () => {};
  const unsubscribe = vi.fn();
  const gateway: PostsGateway = {
    fetchPage: vi.fn(async () => ({ posts: [], hasMore: false })),
    insertPost: vi.fn(async (submission) => savedPost(submission)),
    findPost: vi.fn(async () => null),
    subscribe: vi.fn((postListener, statusListener) => {
      onPost = postListener;
      onStatus = statusListener;
      return unsubscribe;
    }),
  };
  return {
    gateway,
    unsubscribe,
    emitPost: (post: Post) => onPost(post),
    emitStatus: (status: ConnectionStatus) => onStatus(status),
  };
}

describe("wall behavior", () => {
  it("never substitutes fake content for missing configuration", () => {
    const store = new WallStore(null);
    store.start();
    expect(store.getSnapshot()).toMatchObject({
      posts: [],
      isLoading: false,
      connection: "unavailable",
    });
  });

  it("preserves an insert that arrives while the initial fetch is delayed", async () => {
    const test = fixture();
    const initialRead = deferred<PostPage>();
    vi.mocked(test.gateway.fetchPage).mockReturnValue(initialRead.promise);
    const store = new WallStore(test.gateway);
    store.start();
    test.emitPost(
      savedPost({ id: "incoming", content: "Hello", image_path: null }),
    );
    initialRead.resolve({ posts: [], hasMore: false });
    await initialRead.promise;
    expect(store.getSnapshot().posts.map((post) => post.id)).toEqual([
      "incoming",
    ]);
    store.stop();
  });

  it("keeps the first window at 20 during delayed events and pages from the actual visible boundary", async () => {
    const test = fixture();
    const initialRead = deferred<PostPage>();
    const pagePosts = Array.from({ length: PAGE_SIZE }, (_, index) =>
      savedPost(
        {
          id: `initial-${index}`,
          content: `Message ${index}`,
          image_path: null,
        },
        new Date(Date.UTC(2026, 10, 15, 0, 0, PAGE_SIZE - index)).toISOString(),
      ),
    );
    vi.mocked(test.gateway.fetchPage).mockReturnValueOnce(initialRead.promise);
    const store = new WallStore(test.gateway);
    store.start();
    const arrival = savedPost(
      {
        id: "arrival",
        content: "Arrived during initial read",
        image_path: null,
      },
      "2026-11-15T00:01:00Z",
    );
    test.emitPost(arrival);
    initialRead.resolve({ posts: pagePosts, hasMore: false });
    await initialRead.promise;
    expect(store.getSnapshot().posts).toHaveLength(PAGE_SIZE);
    expect(store.getSnapshot().posts[0]).toEqual(arrival);
    expect(store.getSnapshot().hasMore).toBe(true);
    vi.mocked(test.gateway.fetchPage).mockResolvedValueOnce({
      posts: [pagePosts.at(-1)!],
      hasMore: false,
    });
    await store.loadOlder();
    expect(test.gateway.fetchPage).toHaveBeenLastCalledWith(pagePosts.at(-2));
    expect(store.getSnapshot().posts).toHaveLength(PAGE_SIZE + 1);
    expect(store.getSnapshot().posts.at(-1)).toEqual(pagePosts.at(-1));
    store.stop();
  });

  it("leaves delayed events outside the loaded range for the next older page", async () => {
    const test = fixture();
    const allPosts = Array.from({ length: 35 }, (_, index) =>
      savedPost({
        id: `batch-${String(index).padStart(2, "0")}`,
        content: `Message ${index}`,
        image_path: null,
      }),
    ).reverse();
    vi.mocked(test.gateway.fetchPage).mockResolvedValueOnce({
      posts: allPosts.slice(0, PAGE_SIZE),
      hasMore: true,
    });
    const store = new WallStore(test.gateway);
    store.start();
    await Promise.resolve();
    for (const post of allPosts) test.emitPost(post);
    expect(store.getSnapshot().posts).toEqual(allPosts.slice(0, PAGE_SIZE));
    vi.mocked(test.gateway.fetchPage).mockResolvedValueOnce({
      posts: allPosts.slice(PAGE_SIZE),
      hasMore: false,
    });
    await store.loadOlder();
    expect(store.getSnapshot().posts).toEqual(allPosts);
    store.stop();
  });

  it("guards simultaneous shares and deduplicates the sender's Realtime event", async () => {
    const test = fixture();
    const insertResult = deferred<Post>();
    vi.mocked(test.gateway.insertPost).mockImplementation((submission) => {
      const post = savedPost(submission);
      test.emitPost(post);
      return insertResult.promise;
    });
    const store = new WallStore(test.gateway);
    store.start();
    const firstShare = store.share("Hello", defaultIdentity);
    expect(await store.share("Hello", defaultIdentity)).toBe(false);
    const submission = vi.mocked(test.gateway.insertPost).mock.calls[0][0];
    insertResult.resolve(savedPost(submission));
    expect(await firstShare).toBe(true);
    expect(store.getSnapshot().posts).toHaveLength(1);
    expect(test.gateway.insertPost).toHaveBeenCalledTimes(1);
    store.stop();
  });

  it("reuses the submission ID after an ambiguous failure", async () => {
    const test = fixture();
    vi.mocked(test.gateway.insertPost).mockRejectedValueOnce(
      new PostRequestError("Couldn't confirm", true),
    );
    const store = new WallStore(test.gateway);
    store.start();
    expect(await store.share("Retry me", defaultIdentity)).toBe(false);
    const firstIdentifier = vi.mocked(test.gateway.insertPost).mock.calls[0][0]
      .id;
    expect(await store.share("Retry me", defaultIdentity)).toBe(true);
    expect(vi.mocked(test.gateway.insertPost).mock.calls[1][0].id).toBe(
      firstIdentifier,
    );
    store.stop();
  });

  it("recovers a committed row when its response was lost", async () => {
    const test = fixture();
    vi.mocked(test.gateway.insertPost).mockImplementation(
      async (submission) => {
        vi.mocked(test.gateway.findPost).mockResolvedValue(
          savedPost(submission),
        );
        throw new PostRequestError("Response lost", true);
      },
    );
    const store = new WallStore(test.gateway);
    store.start();
    expect(await store.share("Saved after all", defaultIdentity)).toBe(true);
    expect(store.getSnapshot().posts).toHaveLength(1);
    store.stop();
  });

  it("reconciles on reconnect and cleans subscriptions on restart", async () => {
    const test = fixture();
    const store = new WallStore(test.gateway);
    store.start();
    test.emitStatus("live");
    await Promise.resolve();
    expect(test.gateway.fetchPage).toHaveBeenCalledTimes(2);
    store.stop();
    store.start();
    store.stop();
    expect(test.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("ignores an earlier request after a newer refresh completes", async () => {
    const test = fixture();
    const stale = deferred<PostPage>();
    vi.mocked(test.gateway.fetchPage).mockReturnValueOnce(stale.promise);
    const store = new WallStore(test.gateway);
    store.start();
    await store.refresh();
    stale.reject(new Error("stale failure"));
    await Promise.resolve();
    expect(store.getSnapshot().readError).toBeNull();
    store.stop();
  });

  it("loads the next page from its snapshot cursor while new messages arrive", async () => {
    const test = fixture();
    const older = savedPost(
      { id: "older", content: "Older", image_path: null },
      "2026-11-14T00:00:00Z",
    );
    const newest = savedPost({
      id: "newest",
      content: "New",
      image_path: null,
    });
    vi.mocked(test.gateway.fetchPage).mockResolvedValueOnce({
      posts: [older],
      hasMore: true,
    });
    const store = new WallStore(test.gateway);
    store.start();
    await Promise.resolve();
    test.emitPost(newest);
    await store.loadOlder();
    expect(test.gateway.fetchPage).toHaveBeenLastCalledWith(older);
    expect(store.getSnapshot().posts.map((post) => post.id)).toEqual([
      "newest",
      "older",
    ]);
    store.stop();
  });

  it("bridges a multi-page event gap after reconnecting", async () => {
    const test = fixture();
    const previousPost = savedPost(
      { id: "previous", content: "Previous", image_path: null },
      "2026-11-14T00:00:00Z",
    );
    const firstMissed = savedPost({
      id: "first-missed",
      content: "Missed one",
      image_path: null,
    });
    const secondMissed = savedPost(
      { id: "second-missed", content: "Missed two", image_path: null },
      "2026-11-15T00:00:01Z",
    );
    vi.mocked(test.gateway.fetchPage)
      .mockResolvedValueOnce({ posts: [previousPost], hasMore: false })
      .mockResolvedValueOnce({ posts: [secondMissed], hasMore: true })
      .mockResolvedValueOnce({
        posts: [firstMissed, previousPost],
        hasMore: false,
      });
    const store = new WallStore(test.gateway);
    store.start();
    await Promise.resolve();
    await store.refresh();
    expect(store.getSnapshot().posts.map((post) => post.id)).toEqual([
      "second-missed",
      "first-missed",
      "previous",
    ]);
    store.stop();
  });

  it("discards callbacks from a stopped subscription", () => {
    const test = fixture();
    const store = new WallStore(test.gateway);
    store.start();
    store.stop();
    test.emitPost(
      savedPost({ id: "stale", content: "Old callback", image_path: null }),
    );
    expect(store.getSnapshot().posts).toHaveLength(0);
  });
});
