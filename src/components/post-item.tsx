import Image from "next/image";
import { publicPhotoUrl } from "@/lib/photos";
import type { Post } from "@/lib/posts";
import { visitorLabel } from "@/lib/visitor-identity";

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PostItem({ post }: { post: Post }) {
  const author = post.author_name ?? visitorLabel(post.visitor_id);
  const photoUrl = post.image_path ? publicPhotoUrl(post.image_path) : null;
  const createdAt = new Date(post.created_at);
  const initials = post.author_name
    ? post.author_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join("")
        .toUpperCase()
    : (post.visitor_id?.slice(0, 2).toUpperCase() ?? "V");

  return (
    <li
      className="post-row"
      data-post-id={post.id}
      data-visitor-id={post.visitor_id ?? ""}
    >
      <article aria-labelledby={`author-${post.id}`}>
        <div className="post-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="post-body">
          <div className="post-byline">
            <h3 id={`author-${post.id}`}>{author}</h3>
            <time dateTime={post.created_at} title={createdAt.toLocaleString()}>
              {timestampFormatter.format(createdAt)}
            </time>
          </div>
          {post.content && <p className="post-message">{post.content}</p>}
          {photoUrl && (
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="post-photo-link"
              aria-label={`Open full-size photo from ${author}`}
            >
              <Image
                src={photoUrl}
                width={800}
                height={600}
                unoptimized
                alt="Photo shared with this message"
                className="post-photo"
              />
            </a>
          )}
        </div>
      </article>
    </li>
  );
}
