import { visitorLabel } from "@/lib/visitor-identity";

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

export function postAuthorLabel(
  post: Pick<Post, "author_name" | "visitor_id">,
): string {
  return post.author_name ?? visitorLabel(post.visitor_id);
}

export function countCharacters(content: string): number {
  return Array.from(content).length;
}

export function validateMessage(content: string): string | null {
  if (!content.trim()) return "Write a little something before sharing.";
  if (countCharacters(content) > MAX_MESSAGE_LENGTH) {
    return `Keep your message to ${MAX_MESSAGE_LENGTH} characters or fewer.`;
  }
  return null;
}

export function mergePosts(
  currentPosts: Post[],
  incomingPosts: Post[],
): Post[] {
  const postsByIdentifier = new Map(
    currentPosts.map((post) => [post.id, post]),
  );
  for (const post of incomingPosts) postsByIdentifier.set(post.id, post);
  return [...postsByIdentifier.values()].sort((firstPost, secondPost) => {
    const timeDifference =
      Date.parse(secondPost.created_at) - Date.parse(firstPost.created_at);
    if (timeDifference) return timeDifference;
    // Postgres preserves microseconds that JavaScript's Date truncates.
    const firstMicroseconds = (firstPost.created_at.match(/\.(\d+)/)?.[1] ?? "")
      .padEnd(6, "0")
      .slice(3, 6);
    const secondMicroseconds = (
      secondPost.created_at.match(/\.(\d+)/)?.[1] ?? ""
    )
      .padEnd(6, "0")
      .slice(3, 6);
    return (
      secondMicroseconds.localeCompare(firstMicroseconds) ||
      secondPost.id.localeCompare(firstPost.id)
    );
  });
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
