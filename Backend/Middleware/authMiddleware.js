
const jwt = require("jsonwebtoken");
const User = require("../Models/userModel");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication token required",
    });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }

  try {
    // A token outlives the account that owns it, so check the account still exists.
    // Otherwise a deleted user could keep creating likes and comments.
    if (!(await User.exists({ _id: decoded.sub }))) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  } catch (error) {
    return res.status(500).json({ message: "server error" });
  }

  req.user = { id: decoded.sub };
  next();
}

module.exports = authenticateToken;
