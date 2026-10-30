const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const authenticateToken = require("../Middleware/authMiddleware");
const { upload, list, remove } = require("../Controllers/videoController");
const {
  like,
  unlike,
  listComments,
  addComment,
  deleteComment,
} = require("../Controllers/engagementController");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

// Browser recordings send types like "video/webm;codecs=vp9,opus"; ignore the codec part.
const baseType = (file) => file.mimetype.split(";")[0];

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) =>
    cb(null, crypto.randomUUID() + ALLOWED_TYPES[baseType(file)]),
});

const uploader = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[baseType(file)]) return cb(null, true);
    cb(new Error("Only MP4, WebM or MOV videos are allowed"));
  },
});

const router = express.Router();

router.get("/", authenticateToken, list);
router.put("/:id/like", authenticateToken, like);
router.delete("/:id/like", authenticateToken, unlike);
router.get("/:id/comments", authenticateToken, listComments);
router.post("/:id/comments", authenticateToken, addComment);
router.delete("/:id/comments/:commentId", authenticateToken, deleteComment);
router.delete("/:id", authenticateToken, remove);
router.post(
  "/",
  authenticateToken,
  (req, res, next) =>
    uploader.single("video")(req, res, (err) => {
      if (!err) return next();
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Video must be 100MB or smaller"
          : err.message;
      res.status(400).json({ message });
    }),
  upload
);

module.exports = router;
