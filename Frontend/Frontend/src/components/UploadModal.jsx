import { useState } from "react";
import CameraRecorder from "./CameraRecorder";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function UploadModal({ token, onClose, onUploaded }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("file"); // "file" | "record"
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function switchMode(next) {
    setMode(next);
    setFile(null);
    setMessage("");
  }

  async function handleUpload(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("video", file);

      const response = await fetch(`${API_URL}/api/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      onUploaded(data.video);
      onClose();
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Cannot connect to the server. Check your backend and CORS settings."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Upload video"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Upload video</h2>

        <div className="upload-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "file"}
            className={mode === "file" ? "active" : ""}
            onClick={() => switchMode("file")}
            disabled={loading}
          >
            Upload file
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "record"}
            className={mode === "record" ? "active" : ""}
            onClick={() => switchMode("record")}
            disabled={loading}
          >
            Record (30s)
          </button>
        </div>

        <form className="login-form" onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
          />

          {mode === "file" ? (
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(event) => setFile(event.target.files[0] || null)}
              required
            />
          ) : (
            <CameraRecorder onRecorded={setFile} />
          )}

          {message && (
            <p className="form-message error" role="status">
              {message}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading || !file}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>
          <button
            className="modal-cancel"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default UploadModal;
