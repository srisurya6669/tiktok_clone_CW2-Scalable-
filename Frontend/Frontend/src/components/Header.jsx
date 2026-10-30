
function Header({ isSignUp, onSignUp, onLogin }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="TikTok home">
        <span className="brand-note">♪</span>
        <span>ScaleTok</span>
      </a>

      <div className="topbar-signup">
        <span>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
        </span>
        <button
          className="signup-button"
          onClick={isSignUp ? onLogin : onSignUp}
        >
          {isSignUp ? "Log in" : "Sign up"}
        </button>
      </div>
    </header>
  );
}

export default Header;
