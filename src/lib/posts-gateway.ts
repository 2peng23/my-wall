import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PAGE_SIZE,
  matchesSubmission,
  PostRequestError,
  type PendingPost,
  type Post,
  type PostsGateway,
} from "@/lib/posts";

const POST_COLUMNS =
  "id, author_name, visitor_id, content, created_at, image_path";

function requestError(
  error: { code?: string; message?: string },
  operation: "read" | "write",
) {
  if (error.code === "23514" || error.code === "22001") {
    return new PostRequestError(
      "Your message couldn't be saved. Check the character limit and try again.",
    );
  }
  if (error.code === "42501") {
    return new PostRequestError(
      "Sharing is temporarily unavailable. Please try again later.",
    );
  }
  return new PostRequestError(
    operation === "read"
      ? "We couldn't load the wall. Please try again."
      : "We couldn't confirm your message was saved. Try sharing again to check safely.",
    operation === "write" && (!error.code || error.code === "PGRST000"),
  );
}

export function createPostsGateway(client: SupabaseClient): PostsGateway {
  return {
    async fetchPage(cursor) {
      let query = client
        .from("posts")
        .select(POST_COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        );
      }
      const { data, error } = await query.abortSignal(
        AbortSignal.timeout(12_000),
      );
      if (error) throw requestError(error, "read");
      return {
        posts: (data ?? []).slice(0, PAGE_SIZE) as Post[],
        hasMore: (data?.length ?? 0) > PAGE_SIZE,
      };
    },
    async insertPost(post: PendingPost) {
      const { data, error } = await client
        .from("posts")
        .insert(post)
        .select(POST_COLUMNS)
        .abortSignal(AbortSignal.timeout(15_000))
        .single();
      if (error) {
        // The same submission identity can already exist after an uncertain response.
        if (error.code === "23505") {
          const { data: existingPost, error: lookupError } = await client
            .from("posts")
            .select(POST_COLUMNS)
            .eq("id", post.id)
            .abortSignal(AbortSignal.timeout(12_000))
            .maybeSingle();
          if (
            !lookupError &&
            existingPost &&
            matchesSubmission(existingPost as Post, post)
          ) {
            return existingPost as Post;
          }
        }
        throw requestError(error, "write");
      }
      return data as Post;
    },
    async findPost(identifier) {
      const { data, error } = await client
        .from("posts")
        .select(POST_COLUMNS)
        .eq("id", identifier)
        .abortSignal(AbortSignal.timeout(12_000))
        .maybeSingle();
      if (error) throw requestError(error, "read");
      return data as Post | null;
    },
    subscribe(onPost, onStatus) {
      const channel = client
        .channel(`wall-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "posts" },
          (payload) => onPost(payload.new as Post),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") onStatus("live");
          else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          )
            onStatus("reconnecting");
        });
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
