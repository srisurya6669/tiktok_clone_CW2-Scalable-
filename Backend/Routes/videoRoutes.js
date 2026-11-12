const express = require("express");
const authenticateToken = require("../Middleware/authMiddleware");
const {
  uploadUrl,
  upload,
  list,
  remove,
} = require("../Controllers/videoController");
const {
  like,
  unlike,
  listComments,
  addComment,
  deleteComment,
} = require("../Controllers/engagementController");

const router = express.Router();

router.get("/", authenticateToken, list);
router.post("/upload-url", authenticateToken, uploadUrl);
router.put("/:id/like", authenticateToken, like);
router.delete("/:id/like", authenticateToken, unlike);
router.get("/:id/comments", authenticateToken, listComments);
router.post("/:id/comments", authenticateToken, addComment);
router.delete("/:id/comments/:commentId", authenticateToken, deleteComment);
router.delete("/:id", authenticateToken, remove);
router.post("/", authenticateToken, upload);

module.exports = router;
