import { Fragment, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PlusIcon } from "./Icons";
import UploadModal from "./UploadModal";
import "./HomePage.css";

function AppLayout({ user, token, onLogout }) {
  const navigate = useNavigate();
  const onProfile = useLocation().pathname === "/profile";
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="app-shell home-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="ScaleTok home">
          <span className="brand-note">♪</span>
          <span>ScaleTok</span>
        </Link>

        <div className="topbar-actions">
          <button
            className="upload-button"
            onClick={() => setShowUpload(true)}
            aria-label="Upload video"
            title="Upload video"
          >
            <PlusIcon />
          </button>

          <button
            className={`topbar-user ${onProfile ? "active" : ""}`}
            onClick={() => navigate("/profile")}
            aria-label="Open your profile"
          >
            <span className="topbar-avatar" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="topbar-username">{user.name}</span>
          </button>
        </div>
      </header>

      <div className={`app-body ${onProfile ? "" : "is-feed"}`}>
        {/* Left sidebar: intentionally empty for now. Not shown on the profile. */}
        {!onProfile && <aside className="left-sidebar" aria-label="Sidebar" />}

        <div className="app-content">
          {/* Changing the key re-mounts the page so it reloads after an upload. */}
          <Fragment key={refreshKey}>
            <Outlet context={{ user, token, onLogout }} />
          </Fragment>
        </div>
      </div>

      {showUpload && (
        <UploadModal
          token={token}
          onClose={() => setShowUpload(false)}
          onUploaded={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </main>
  );
}

export default AppLayout;
