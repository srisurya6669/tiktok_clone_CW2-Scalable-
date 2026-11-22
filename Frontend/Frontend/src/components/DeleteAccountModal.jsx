import { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Asks for the password again, then permanently deletes the account and everything it owns.
function DeleteAccountModal({ token, onClose, onDeleted }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not delete your account");
      }

      onDeleted();
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Cannot connect to the server. Please try again."
          : error.message
      );
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Delete account"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Delete your account?</h2>
        <p className="delete-warning">
          This permanently deletes your account, every video you uploaded, and
          all of your likes and comments. This cannot be undone.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter your password to confirm"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />

          {message && (
            <p className="form-message error" role="status">
              {message}
            </p>
          )}

          <button
            className="login-button danger-button"
            type="submit"
            disabled={loading || !password}
          >
            {loading ? "Deleting..." : "Delete my account"}
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

export default DeleteAccountModal;
