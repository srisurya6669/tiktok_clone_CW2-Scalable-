
import { useState } from "react";
import HomePage from "./components/HomePage";
import Header from "./components/Header";
import Divider from "./components/Divider";
import LoginForm from "./components/LoginForm";
import SignUpForm from "./components/SignUpForm";
import VideoCollage from "./components/VideoCollage";
import "./App.css";

function App() {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  function handleLoginSuccess(authData) {
    // Keep the token in memory for this example.
    setAuthenticatedUser(authData);
  }

  function handleLogout() {
    setAuthenticatedUser(null);
    setIsSignUp(false);
  }

  function handleSignUp() {
    setIsSignUp(true);
  }

  function handleShowLogin() {
    setIsSignUp(false);
  }

  if (authenticatedUser) {
    return (
      <HomePage
        user={authenticatedUser.user}
        token={authenticatedUser.token}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <main className="app-shell">
      <Header
        isSignUp={isSignUp}
        onSignUp={handleSignUp}
        onLogin={handleShowLogin}
      />

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
              <SignUpForm onLoginSuccess={handleLoginSuccess} />
            ) : (
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            )}
          </div>
        </section>

        <VideoCollage />
      </div>
    </main>
  );
}

export default App;
