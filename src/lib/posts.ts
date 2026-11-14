export const MAX_MESSAGE_LENGTH = 280;
export const PAGE_SIZE = 20;

export type Post = {
  id: string;
  author_name: string | null;
  visitor_id: string | null;
  content: string;
  created_at: string;
  image_path: string | null;
};

export type PostCursor = Pick<Post, "id" | "created_at">;
export type PostPage = { posts: Post[]; hasMore: boolean };
export type ConnectionStatus =
  "connecting" | "live" | "reconnecting" | "unavailable";
export type PendingPost = {
  id: string;
  visitor_id: string;
  author_name: string | null;
  content: string;
  image_path: string | null;
};

export function countCharacters(content: string): number {
  return Array.from(content).length;
}

export function validateMessage(
  content: string,
  hasPhoto = false,
): string | null {
  if (countCharacters(content) > MAX_MESSAGE_LENGTH) {
    return `Keep your message to ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  }
  if (!content.trim() && !hasPhoto)
    return "Write a message or attach a photo before sharing.";
  return null;
}

export function comparePostsNewestFirst(
  firstPost: Post,
  secondPost: Post,
): number {
  const timeDifference =
    Date.parse(secondPost.created_at) - Date.parse(firstPost.created_at);
  if (timeDifference) return timeDifference;
  // Postgres preserves microseconds that JavaScript's Date truncates.
  const firstMicroseconds = (firstPost.created_at.match(/\.(\d+)/)?.[1] ?? "")
    .padEnd(6, "0")
    .slice(3, 6);
  const secondMicroseconds = (secondPost.created_at.match(/\.(\d+)/)?.[1] ?? "")
    .padEnd(6, "0")
    .slice(3, 6);
  return (
    secondMicroseconds.localeCompare(firstMicroseconds) ||
    secondPost.id.localeCompare(firstPost.id)
  );
}

export function mergePosts(
  currentPosts: readonly Post[],
  incomingPosts: readonly Post[],
): Post[] {
  const postsByIdentifier = new Map(
    currentPosts.map((post) => [post.id, post]),
  );
  for (const post of incomingPosts) postsByIdentifier.set(post.id, post);
  return [...postsByIdentifier.values()].sort(comparePostsNewestFirst);
}

export function matchesSubmission(
  post: Post,
  submission: PendingPost,
): boolean {
  return (
    post.id === submission.id &&
    post.content === submission.content &&
    post.image_path === submission.image_path &&
    post.visitor_id === submission.visitor_id &&
    post.author_name === submission.author_name
  );
}

export interface PostsGateway {
  fetchPage(cursor?: PostCursor): Promise<PostPage>;
  insertPost(post: PendingPost): Promise<Post>;
  findPost(identifier: string): Promise<Post | null>;
  subscribe(
    onPost: (post: Post) => void,
    onStatus: (status: ConnectionStatus) => void,
  ): () => void;
}

export class PostRequestError extends Error {
  constructor(
    message: string,
    public readonly isUncertain = false,
  ) {
    super(message);
    this.name = "PostRequestError";
  }
}
