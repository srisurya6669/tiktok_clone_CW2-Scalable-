const mongoose = require("mongoose");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");

const commentToResponse = (comment) => ({
  id: comment._id,
  text: comment.text,
  author: comment.user?.name,
  userId: comment.user?._id,
  createdAt: comment.createdAt,
});

async function findVideo(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Video not found" });
    return null;
  }
  const video = await Video.findById(req.params.id);
  if (!video) res.status(404).json({ message: "Video not found" });
  return video;
}

exports.like = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    try {
      await Like.create({ video: video._id, user: req.user.id });
      video.likesCount = (
        await Video.findByIdAndUpdate(video._id, { $inc: { likesCount: 1 } }, { new: true })
      ).likesCount;
    } catch (error) {
      if (error.code !== 11000) throw error; // already liked
    }

    res.json({ liked: true, likesCount: video.likesCount ?? 0 });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

exports.unlike = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    const result = await Like.deleteOne({ video: video._id, user: req.user.id });
    if (result.deletedCount > 0) {
      video.likesCount = (
        await Video.findByIdAndUpdate(video._id, { $inc: { likesCount: -1 } }, { new: true })
      ).likesCount;
    }

    res.json({ liked: false, likesCount: video.likesCount ?? 0 });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

exports.listComments = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const filter = { video: video._id };

    if (req.query.before) {
      const before = new Date(req.query.before);
      if (Number.isNaN(before.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' value" });
      }
      filter.createdAt = { $lt: before };
    }

    const comments = await Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("user", "name");

    res.json({
      comments: comments.slice(0, limit).map(commentToResponse),
      hasMore: comments.length > limit,
    });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

exports.addComment = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    const text = (req.body.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }
    if (text.length > 500) {
      return res.status(400).json({ message: "Comment must be 500 characters or fewer" });
    }

    const comment = await Comment.create({
      video: video._id,
      user: req.user.id,
      text,
    });
    await Video.findByIdAndUpdate(video._id, { $inc: { commentsCount: 1 } });
    await comment.populate("user", "name");

    res.status(201).json({ comment: commentToResponse(comment) });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    if (!mongoose.isValidObjectId(req.params.commentId)) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = await Comment.findOne({
      _id: req.params.commentId,
      video: video._id,
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    await comment.deleteOne();
    await Video.findByIdAndUpdate(video._id, { $inc: { commentsCount: -1 } });
    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};
