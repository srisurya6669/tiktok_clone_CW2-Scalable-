import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import VideoPlayer from "./VideoPlayer";
import "./ProfilePage.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";
const PAGE_SIZE = 12;

function ProfilePage() {
  const { user, token, onLogout } = useOutletContext();
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cursorRef = useRef(null);
  const startedRef = useRef(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        user: user._id,
        limit: PAGE_SIZE,
      });
      if (cursorRef.current) params.set("before", cursorRef.current);

      const response = await fetch(`${API_URL}/api/videos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load videos");

      if (data.videos.length > 0) {
        cursorRef.current = data.videos[data.videos.length - 1].createdAt;
      }
      setVideos((previous) => [
        ...previous,
        ...data.videos.map((video) => ({
          ...video,
          src: `${API_URL}${video.src}`,
        })),
      ]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user._id, token]);

  useEffect(() => {
    // Guard against React StrictMode running the effect twice in dev.
    if (startedRef.current) return;
    startedRef.current = true;
    loadVideos();
  }, [loadVideos]);

  async function handleDelete(id) {
    if (!window.confirm("Delete this video?")) return;

    try {
      const response = await fetch(`${API_URL}/api/videos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Delete failed");
      }

      setVideos((previous) => previous.filter((video) => video.id !== id));
      setTotal((count) => count - 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="profile-details">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          {joined && <p className="profile-meta">Joined {joined}</p>}
          <p className="profile-meta">
            {total} {total === 1 ? "video" : "videos"}
          </p>
        </div>

        <button
          className="signup-button btn-secondary profile-logout"
          onClick={onLogout}
        >
          Log out
        </button>
      </div>

      <h2 className="profile-heading">My videos</h2>

      {error && (
        <p className="form-message error" role="status">
          {error}
        </p>
      )}

      {!loading && videos.length === 0 && !error && (
        <p className="profile-empty">
          You haven’t uploaded any videos yet. Click “+ Upload” to add one.
        </p>
      )}

      <div className="profile-grid">
        {videos.map((video) => (
          <article className="profile-video" key={video.id}>
            <VideoPlayer src={video.src} title={video.title} />
            <div className="profile-video-info">
              <h3>{video.title}</h3>
              <p>
                ♥ {video.likesCount} · 💬 {video.commentsCount}
              </p>
              <button
                className="delete-button"
                onClick={() => handleDelete(video.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {hasMore && (
        <button
          className="profile-more"
          onClick={loadVideos}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </section>
  );
}

export default ProfilePage;
