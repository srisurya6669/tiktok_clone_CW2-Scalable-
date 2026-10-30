
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";
import Header from "./components/Header";
import Divider from "./components/Divider";
import LoginForm from "./components/LoginForm";
import SignUpForm from "./components/SignUpForm";
import VideoCollage from "./components/VideoCollage";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";
const TOKEN_KEY = "scaletok_token";

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (e.g. private mode); the session just won't persist.
  }
}

function AuthPage({ isSignUp, onLoginSuccess }) {
  return (
    <main className="app-shell">
      <Header isSignUp={isSignUp} />

      <div className="login-layout">
        <section className="login-panel">
          <div className="login-content">
            <h1>{isSignUp ? "Sign up for ScaleTok" : "Log in to ScaleTok"}</h1>

            <p className="subtitle">
              Watch, create and share short videos
              <br className="desktop-break" /> from around the world.
            </p>

            <Divider />

            {isSignUp ? (
              <SignUpForm onLoginSuccess={onLoginSuccess} />
            ) : (
              <LoginForm onLoginSuccess={onLoginSuccess} />
            )}
          </div>
        </section>

        <VideoCollage />
      </div>
    </main>
  );
}

function App() {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [restoringSession, setRestoringSession] = useState(
    () => Boolean(readToken())
  );

  // Restore the session after a page refresh.
  useEffect(() => {
    const token = readToken();
    if (!token) return;

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setAuthenticatedUser({ token, user: data.user });
        } else if (response.status === 401) {
          // Token expired or invalid.
          writeToken(null);
        }
      })
      .catch(() => {})
      .finally(() => setRestoringSession(false));
  }, []);

  function handleLoginSuccess(authData) {
    writeToken(authData.token);
    setAuthenticatedUser(authData);
  }

  function handleLogout() {
    writeToken(null);
    setAuthenticatedUser(null);
  }

  if (restoringSession) {
    return null;
  }

  const loggedIn = Boolean(authenticatedUser);

  return (
    <Routes>
      {/* Public pages: signed-in users are sent to the feed. */}
      <Route
        path="/login"
        element={
          loggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/signup"
        element={
          loggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage isSignUp onLoginSuccess={handleLoginSuccess} />
          )
        }
      />

      {/* Private pages: signed-out users are sent to the login page. */}
      <Route
        element={
          loggedIn ? (
            <AppLayout
              user={authenticatedUser.user}
              token={authenticatedUser.token}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
