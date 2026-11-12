import { useState } from "react";
import CameraRecorder from "./CameraRecorder";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

const MAX_BYTES = 100 * 1024 * 1024;

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
      if (file.size > MAX_BYTES) {
        throw new Error("Video must be 100MB or smaller");
      }

      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // 1. Ask the API for a short-lived URL to upload straight to Azure Blob Storage.
      const urlResponse = await fetch(`${API_URL}/api/videos/upload-url`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ contentType: file.type }),
      });
      const urlData = await urlResponse.json();
      if (!urlResponse.ok) {
        throw new Error(urlData.message || "Upload failed");
      }

      // 2. Upload the file directly to Blob Storage.
      const blobResponse = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": urlData.contentType,
        },
        body: file,
      });
      if (!blobResponse.ok) {
        const detail = await blobResponse.text().catch(() => "");
        const code = detail.match(/<Code>(.*?)<\/Code>/)?.[1];
        const target = new URL(urlData.uploadUrl);
        throw new Error(
          `Upload to storage failed (${blobResponse.status}${code ? ` ${code}` : ""}) ` +
            `${target.host}${target.pathname} ${detail.slice(0, 120)}`
        );
      }

      // 3. Tell the API the upload is done so it can save the video.
      const response = await fetch(`${API_URL}/api/videos`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ title, blobName: urlData.blobName }),
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
