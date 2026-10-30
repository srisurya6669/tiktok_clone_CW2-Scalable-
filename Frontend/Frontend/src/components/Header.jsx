import { Link, useNavigate } from "react-router-dom";

function Header({ isSignUp }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <Link className="brand" to="/" aria-label="ScaleTok home">
        <span className="brand-note">♪</span>
        <span>ScaleTok</span>
      </Link>

      <div className="topbar-signup">
        <span>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
        </span>
        <button
          className="signup-button"
          onClick={() => navigate(isSignUp ? "/login" : "/signup")}
        >
          {isSignUp ? "Log in" : "Sign up"}
        </button>
      </div>
    </header>
  );
}

export default Header;
