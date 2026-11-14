import {
  mergePosts,
  PAGE_SIZE,
  PostRequestError,
  validateMessage,
  type ConnectionStatus,
  type PendingPost,
  type Post,
  type PostCursor,
  type PostsGateway,
} from "@/lib/posts";
import {
  isVisitorIdentifier,
  validateName,
  type PostingIdentity,
} from "@/lib/visitor-identity";

export type WallSnapshot = {
  posts: Post[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isSharing: boolean;
  hasMore: boolean;
  readError: string | null;
  shareError: string | null;
  connection: ConnectionStatus;
  announcement: string;
};

export class WallStore {
  private snapshot: WallSnapshot = {
    posts: [],
    isLoading: true,
    isLoadingOlder: false,
    isSharing: false,
    hasMore: false,
    readError: null,
    shareError: null,
    connection: "connecting",
    announcement: "",
  };
  private listeners = new Set<() => void>();
  private stopSubscription: (() => void) | undefined;
  private cursor: PostCursor | undefined;
  private pendingPost: PendingPost | undefined;
  private generation = 0;
  private refreshSequence = 0;
  private isStarted = false;
  private lastReadWasOlder = false;
  private hasReadInitialPage = false;

  constructor(private readonly gateway: PostsGateway | null) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(changes: Partial<WallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  start = () => {
    if (this.isStarted) return;
    this.isStarted = true;
    this.generation += 1;
    const generation = this.generation;
    if (!this.gateway) {
      this.update({
        isLoading: false,
        connection: "unavailable",
        readError: "The wall isn't connected yet. Please check back soon.",
      });
      return;
    }
    this.stopSubscription = this.gateway.subscribe(
      (post) => {
        if (generation !== this.generation) return;
        const isNew = !this.snapshot.posts.some(
          (existingPost) => existingPost.id === post.id,
        );
        const oldestLoadedPost = this.snapshot.posts.at(-1);
        if (
          this.hasReadInitialPage &&
          this.snapshot.hasMore &&
          isNew &&
          oldestLoadedPost &&
          mergePosts([oldestLoadedPost], [post])[0].id !== post.id
        )
          return;
        const mergedPosts = mergePosts(this.snapshot.posts, [post]);
        this.update({
          posts: this.hasReadInitialPage
            ? mergedPosts
            : mergedPosts.slice(0, PAGE_SIZE),
          ...(!this.hasReadInitialPage && mergedPosts.length > PAGE_SIZE
            ? { hasMore: true }
            : {}),
          ...(isNew && post.id !== this.pendingPost?.id
            ? { announcement: "A new message arrived on the wall." }
            : {}),
        });
      },
      (connection) => {
        if (generation !== this.generation) return;
        this.update({ connection });
        // Fetch again after subscription/reconnection so inserts during the initial read aren't missed.
        if (connection === "live") void this.refresh();
      },
    );
    void this.refresh();
  };

  stop = () => {
    this.isStarted = false;
    this.generation += 1;
    this.stopSubscription?.();
    this.stopSubscription = undefined;
  };

  refresh = async () => {
    if (!this.gateway) return;
    const generation = this.generation;
    const sequence = ++this.refreshSequence;
    this.update({
      readError: null,
      ...(this.snapshot.posts.length ? {} : { isLoading: true }),
    });
    try {
      const knownIdentifiers = new Set(
        this.snapshot.posts.map((post) => post.id),
      );
      const page = await this.gateway.fetchPage();
      let incomingPosts = page.posts;
      let catchupPage = page;
      // A long disconnection may miss more than one page of events. Bridge that gap.
      while (
        this.hasReadInitialPage &&
        knownIdentifiers.size &&
        catchupPage.hasMore &&
        !catchupPage.posts.some((post) => knownIdentifiers.has(post.id))
      ) {
        if (generation !== this.generation || sequence !== this.refreshSequence)
          return;
        catchupPage = await this.gateway.fetchPage(catchupPage.posts.at(-1));
        incomingPosts = mergePosts(incomingPosts, catchupPage.posts);
      }
      if (generation !== this.generation || sequence !== this.refreshSequence)
        return;
      const mergedPosts = mergePosts(this.snapshot.posts, incomingPosts);
      const isInitialPage = !this.hasReadInitialPage;
      const visiblePosts = isInitialPage
        ? mergedPosts.slice(0, PAGE_SIZE)
        : mergedPosts;
      if (isInitialPage) this.cursor = visiblePosts.at(-1);
      this.hasReadInitialPage = true;
      this.update({
        posts: visiblePosts,
        ...(isInitialPage
          ? {
              hasMore:
                page.hasMore ||
                this.snapshot.hasMore ||
                mergedPosts.length > PAGE_SIZE,
            }
          : {}),
        isLoading: false,
        readError: null,
      });
    } catch {
      if (generation !== this.generation || sequence !== this.refreshSequence)
        return;
      this.lastReadWasOlder = false;
      this.update({
        isLoading: false,
        readError:
          "We couldn't load the wall. Check your connection and try again.",
      });
    }
  };

  loadOlder = async () => {
    if (
      !this.gateway ||
      !this.cursor ||
      this.snapshot.isLoadingOlder ||
      !this.snapshot.hasMore
    )
      return;
    const generation = this.generation;
    this.update({ isLoadingOlder: true, readError: null });
    try {
      const page = await this.gateway.fetchPage(this.cursor);
      if (generation !== this.generation) return;
      this.cursor = page.posts.at(-1) ?? this.cursor;
      this.update({
        posts: mergePosts(this.snapshot.posts, page.posts),
        hasMore: page.hasMore,
        isLoadingOlder: false,
      });
    } catch {
      if (generation !== this.generation) return;
      this.lastReadWasOlder = true;
      this.update({
        isLoadingOlder: false,
        readError: "We couldn't load older messages. Please try again.",
      });
    }
  };

  retryRead = () => (this.lastReadWasOlder ? this.loadOlder() : this.refresh());

  markOffline = () => {
    if (this.gateway) this.update({ connection: "reconnecting" });
  };

  share = async (
    content: string,
    identity: PostingIdentity,
    imagePath: string | null = null,
  ): Promise<boolean> => {
    if (!this.gateway || this.snapshot.isSharing) return false;
    const validationError =
      validateMessage(content) ||
      validateName(identity.name) ||
      (!isVisitorIdentifier(identity.visitorId)
        ? "Your visitor identity isn't ready. Please refresh and try again."
        : null);
    if (validationError) {
      this.update({ shareError: validationError });
      return false;
    }
    const normalizedContent = content.trim();
    const authorName = identity.name.trim() || null;
    if (
      !this.pendingPost ||
      this.pendingPost.content !== normalizedContent ||
      this.pendingPost.image_path !== imagePath ||
      this.pendingPost.visitor_id !== identity.visitorId ||
      this.pendingPost.author_name !== authorName
    ) {
      this.pendingPost = {
        id: crypto.randomUUID(),
        visitor_id: identity.visitorId,
        author_name: authorName,
        content: normalizedContent,
        image_path: imagePath,
      };
    }
    const submission = this.pendingPost;
    this.update({ isSharing: true, shareError: null, announcement: "" });
    try {
      const post = await this.gateway.insertPost(submission);
      this.update({
        posts: mergePosts(this.snapshot.posts, [post]),
        isSharing: false,
        announcement: "Your message is on the wall.",
      });
      this.pendingPost = undefined;
      return true;
    } catch (error) {
      // A timeout may mean the commit succeeded but its response was lost.
      if (!(error instanceof PostRequestError) || error.isUncertain) {
        try {
          const savedPost = await this.gateway.findPost(submission.id);
          if (
            savedPost &&
            savedPost.content === submission.content &&
            savedPost.image_path === submission.image_path &&
            savedPost.visitor_id === submission.visitor_id &&
            savedPost.author_name === submission.author_name
          ) {
            this.update({
              posts: mergePosts(this.snapshot.posts, [savedPost]),
              isSharing: false,
              announcement: "Your message is on the wall.",
            });
            this.pendingPost = undefined;
            return true;
          }
        } catch {
          /* Keep the submission identity for a safe explicit retry. */
        }
      }
      this.update({
        isSharing: false,
        shareError:
          error instanceof Error
            ? error.message
            : "We couldn't save your message. Please try again.",
      });
      return false;
    }
  };
}
