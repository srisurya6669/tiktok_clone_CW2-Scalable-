import { useCallback, useEffect, useRef, useState } from "react";
import VideoSlide from "./VideoSlide";
import { useOutletContext } from "react-router-dom";
import "./HomePage.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";
const PAGE_SIZE = 5;

function HomePage() {
  const { user, token } = useOutletContext();
  const [videos, setVideos] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const feedRef = useRef(null);
  const sentinelRef = useRef(null);
  const cursorRef = useRef(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE });
      if (cursorRef.current) params.set("before", cursorRef.current);

      const response = await fetch(`${API_URL}/api/videos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load videos");
      const data = await response.json();

      if (data.videos.length > 0) {
        cursorRef.current = data.videos[data.videos.length - 1].createdAt;
      }

      setVideos((previous) => {
        const known = new Set(previous.map((video) => video.id));
        const fresh = data.videos
          .filter((video) => !known.has(video.id))
          .map((video) => ({ ...video, src: `${API_URL}${video.src}` }));
        return [...previous, ...fresh];
      });
      setHasMore(data.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
    }
  }, [token]);

  // Infinite scroll: load the next page when the end of the feed is near.
  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { root: feedRef.current, rootMargin: "0px 0px 100% 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, videos.length]);

  return (
    <section className="home-feed" ref={feedRef}>
      {videos.map((video) => (
        <VideoSlide
          key={video.id}
          video={video}
          user={user}
          token={token}
        />
      ))}

      {hasMore && <div ref={sentinelRef} className="feed-sentinel" />}

      {!hasMore && videos.length === 0 && (
        <p className="home-empty">
          No videos yet. Click “+ Upload” to share the first one.
        </p>
      )}
    </section>
  );
}

export default HomePage;
