
import { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      const profileResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(
          profileData.message || "Unable to load profile"
        );
      }

      setPassword("");
      setMessage("Login successful!");
      setIsError(false);

      onLoginSuccess({
        token: data.token,
        user: profileData.user,
      });
    } catch (error) {
      setIsError(true);
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
    <form className="login-form" onSubmit={handleLogin}>
      <input
        id="email"
        type="text"
        placeholder="Email or username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="username"
        required
      />

      <div className="password-wrap">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword((previous) => !previous)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {message && (
        <p
          className={`form-message ${isError ? "error" : "success"}`}
          role="status"
        >
          {message}
        </p>
      )}

      <button
        className="login-button"
        type="submit"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

export default LoginForm;
