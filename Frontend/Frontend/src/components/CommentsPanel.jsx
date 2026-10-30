import { useEffect, useRef, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function CommentsPanel({
  videoId,
  token,
  user,
  active,
  commentsCount,
  onCountChange,
}) {
  const [comments, setComments] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  async function loadComments(before) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 20 });
      if (before) params.set("before", before);

      const response = await fetch(
        `${API_URL}/api/videos/${videoId}/comments?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load comments");
      }

      setComments((previous) => [...previous, ...data.comments]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load comments the first time this video becomes the active one.
  useEffect(() => {
    if (active && !loadedRef.current) {
      loadedRef.current = true;
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setPosting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/videos/${videoId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: trimmed }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not post comment");

      setComments((previous) => [data.comment, ...previous]);
      onCountChange(1);
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      const response = await fetch(
        `${API_URL}/api/videos/${videoId}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Could not delete comment");
      }

      setComments((previous) =>
        previous.filter((comment) => comment.id !== commentId)
      );
      onCountChange(-1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <aside className="comments-panel" aria-label="Comments">
      <h3 className="comments-title">Comments ({commentsCount})</h3>

      <ul className="comments-list">
        {comments.map((comment) => (
          <li className="comment" key={comment.id}>
            <div className="comment-head">
              <strong>@{comment.author}</strong>
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p>{comment.text}</p>
            {comment.userId === user._id && (
              <button
                className="comment-delete"
                onClick={() => handleDelete(comment.id)}
              >
                Delete
              </button>
            )}
          </li>
        ))}

        {!loading && comments.length === 0 && (
          <li className="comments-empty">
            No comments yet. Be the first to comment.
          </li>
        )}

        {hasMore && (
          <li>
            <button
              className="comments-more"
              onClick={() =>
                loadComments(comments[comments.length - 1].createdAt)
              }
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more comments"}
            </button>
          </li>
        )}
      </ul>

      {error && (
        <p className="form-message error" role="status">
          {error}
        </p>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add a comment..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
        />
        <button type="submit" disabled={posting || !text.trim()}>
          Post
        </button>
      </form>
    </aside>
  );
}

export default CommentsPanel;
