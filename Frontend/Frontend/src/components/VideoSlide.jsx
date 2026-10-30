import { useState } from "react";
import CommentsPanel from "./CommentsPanel";
import VideoPlayer from "./VideoPlayer";
import { CloseIcon, CommentIcon, HeartIcon } from "./Icons";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function VideoSlide({ video, user, token }) {
  const [active, setActive] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(video.liked);
  const [likesCount, setLikesCount] = useState(video.likesCount);
  const [commentsCount, setCommentsCount] = useState(video.commentsCount);

  async function handleLike() {
    const wasLiked = liked;

    // Optimistic update, rolled back if the request fails.
    setLiked(!wasLiked);
    setLikesCount((count) => count + (wasLiked ? -1 : 1));

    try {
      const response = await fetch(
        `${API_URL}/api/videos/${video.id}/like`,
        {
          method: wasLiked ? "DELETE" : "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error("Like failed");

      const data = await response.json();
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch {
      setLiked(wasLiked);
      setLikesCount((count) => count + (wasLiked ? 1 : -1));
    }
  }

  return (
    <article className="video-slide">
      <div className="video-frame">
        <VideoPlayer
          src={video.src}
          title={video.title}
          autoPlayInView
          onActiveChange={setActive}
        >
          <div className="video-info">
            <h2>{video.title}</h2>
            <p>@{video.author}</p>
          </div>

          <div className="video-actions">
            <button
              className={`action-button ${liked ? "liked" : ""}`}
              onClick={handleLike}
              aria-pressed={liked}
              aria-label={liked ? "Unlike" : "Like"}
            >
              <HeartIcon filled={liked} />
              <span>{likesCount}</span>
            </button>

            <button
              className="action-button comments-toggle"
              onClick={() => setShowComments((open) => !open)}
              aria-label="Toggle comments"
            >
              <CommentIcon />
              <span>{commentsCount}</span>
            </button>
          </div>
        </VideoPlayer>
      </div>

      <div className={`comments-wrap ${showComments ? "open" : ""}`}>
        <button
          className="comments-close"
          onClick={() => setShowComments(false)}
          aria-label="Close comments"
        >
          <CloseIcon />
        </button>
        <CommentsPanel
          videoId={video.id}
          token={token}
          user={user}
          active={active || showComments}
          commentsCount={commentsCount}
          onCountChange={(delta) =>
            setCommentsCount((count) => count + delta)
          }
        />
      </div>
    </article>
  );
}

export default VideoSlide;
