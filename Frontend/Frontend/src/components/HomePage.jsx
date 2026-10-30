import { useEffect, useState } from "react";
import sampleVideos from "../data/videos";
import UploadModal from "./UploadModal";
import "./HomePage.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function HomePage({ user, token, onLogout }) {
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/videos`)
      .then((response) => response.json())
      .then((data) => setUploadedVideos(data.videos || []))
      .catch(() => {});
  }, []);

  function handleUploaded(video) {
    setUploadedVideos((previous) => [video, ...previous]);
  }

  const videos = [
    ...uploadedVideos.map((video) => ({
      ...video,
      src: `${API_URL}${video.src}`,
    })),
    ...sampleVideos,
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ScaleTok home">
          <span className="brand-note">♪</span>
          <span>ScaleTok</span>
        </a>

        <div className="topbar-actions">
          <button
            className="upload-button"
            onClick={() => setShowUpload(true)}
          >
            + Upload
          </button>

          <div className="topbar-signup">
            <span>{user.name}</span>
            <button className="signup-button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="home-feed">
        <h1 className="home-title">Welcome, {user.name}!</h1>

        <div className="video-grid">
          {videos.map((video) => (
            <article className="video-card" key={video.id}>
              <video
                src={video.src}
                poster={video.poster}
                controls
                preload="none"
                playsInline
              />
              <div className="video-info">
                <h2>{video.title}</h2>
                <p>@{video.author}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showUpload && (
        <UploadModal
          token={token}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </main>
  );
}

export default HomePage;
