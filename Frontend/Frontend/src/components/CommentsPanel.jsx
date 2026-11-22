import { useEffect, useRef, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const EMPTY_SUMMARY = { positive: 0, neutral: 0, negative: 0, mixed: 0 };

// Languages offered for translating a comment (Azure AI Translator codes).
const LANGUAGES = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["te", "Telugu"],
  ["ar", "Arabic"],
  ["zh-Hans", "Chinese"],
  ["pt", "Portuguese"],
];

const browserLanguage = () => {
  const code = (navigator.language || "en").split("-")[0];
  return LANGUAGES.some(([value]) => value === code) ? code : "en";
};

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
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [topics, setTopics] = useState([]);
  const [targetLanguage, setTargetLanguage] = useState(browserLanguage);
  // Translations by comment id: { text, shown } or { loading: true }.
  const [translations, setTranslations] = useState({});
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
      setSummary(data.sentimentSummary || EMPTY_SUMMARY);
      setTopics(data.topTopics || []);
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
      adjustSummary(data.comment.sentiment, 1);
      onCountChange(1);
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function adjustSummary(sentiment, change) {
    if (!sentiment) return;
    setSummary((previous) => ({
      ...previous,
      [sentiment]: Math.max(0, previous[sentiment] + change),
    }));
  }

  async function handleDelete(commentId) {
    const deleted = comments.find((comment) => comment.id === commentId);
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
      adjustSummary(deleted?.sentiment, -1);
      onCountChange(-1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTranslate(comment) {
    const existing = translations[comment.id];
    if (existing?.text && existing.to === targetLanguage) {
      // Already translated into this language: just flip between original and translation.
      setTranslations((previous) => ({
        ...previous,
        [comment.id]: { ...existing, shown: !existing.shown },
      }));
      return;
    }

    setTranslations((previous) => ({ ...previous, [comment.id]: { loading: true } }));
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/videos/${videoId}/comments/${comment.id}/translate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: targetLanguage }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not translate comment");

      setTranslations((previous) => ({
        ...previous,
        [comment.id]: { text: data.text, to: targetLanguage, shown: true },
      }));
    } catch (err) {
      setTranslations((previous) => {
        const rest = { ...previous };
        delete rest[comment.id];
        return rest;
      });
      setError(err.message);
    }
  }

  const analysed =
    summary.positive + summary.neutral + summary.negative + summary.mixed;

  return (
    <aside className="comments-panel" aria-label="Comments">
      <h3 className="comments-title">Comments ({commentsCount})</h3>

      {analysed > 0 && (
        <p className="sentiment-summary" aria-label="Comment sentiment">
          <span className="sentiment-positive">{summary.positive} positive</span>
          <span className="sentiment-neutral">{summary.neutral} neutral</span>
          <span className="sentiment-negative">{summary.negative} negative</span>
        </p>
      )}

      {topics.length > 0 && (
        <p className="comment-topics" aria-label="Popular topics">
          Topics:{" "}
          {topics.map((topic) => (
            <span key={topic.phrase}>{topic.phrase}</span>
          ))}
        </p>
      )}

      <label className="translate-language">
        Translate to
        <select
          value={targetLanguage}
          onChange={(event) => setTargetLanguage(event.target.value)}
        >
          {LANGUAGES.map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <ul className="comments-list">
        {comments.map((comment) => (
          <li className="comment" key={comment.id}>
            <div className="comment-head">
              <strong>
                @{comment.author}
                {comment.sentiment && (
                  <span
                    className={`sentiment-badge sentiment-${comment.sentiment}`}
                  >
                    {comment.sentiment}
                  </span>
                )}
              </strong>
              <time dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p>
              {translations[comment.id]?.shown
                ? translations[comment.id].text
                : comment.text}
            </p>
            {comment.redacted && (
              <p className="comment-note">Personal details were hidden</p>
            )}
            {comment.keyPhrases?.length > 0 && (
              <ul className="comment-phrases" aria-label="Key phrases">
                {comment.keyPhrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            )}
            <button
              className="comment-translate"
              onClick={() => handleTranslate(comment)}
              disabled={translations[comment.id]?.loading}
            >
              {translations[comment.id]?.loading
                ? "Translating..."
                : translations[comment.id]?.shown
                  ? "Show original"
                  : "Translate"}
            </button>
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
