const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");

const toResponse = (video, liked = false) => ({
  id: video._id,
  title: video.title,
  author: video.user?.name,
  userId: video.user?._id,
  src: `/uploads/${video.filename}`,
  likesCount: video.likesCount ?? 0,
  commentsCount: video.commentsCount ?? 0,
  liked,
  createdAt: video.createdAt,
});

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Video file is required" });
  }

  try {
    const title = (req.body.title || "").trim() || req.file.originalname;
    const video = await Video.create({
      title,
      filename: req.file.filename,
      user: req.user.id,
    });
    await video.populate("user", "name");
    res.status(201).json({ video: toResponse(video) });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ message: error.message });
  }
};

exports.list = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const filter = {};

    // Optional filter used by the profile page: only this user's videos.
    if (req.query.user) {
      if (!mongoose.isValidObjectId(req.query.user)) {
        return res.status(400).json({ message: "Invalid 'user' value" });
      }
      filter.user = req.query.user;
    }

    // Cursor pagination: only videos older than the last one the client has.
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (Number.isNaN(before.getTime())) {
        return res.status(400).json({ message: "Invalid 'before' value" });
      }
      filter.createdAt = { $lt: before };
    }

    const videos = await Video.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("user", "name");

    const hasMore = videos.length > limit;
    const page = videos.slice(0, limit);

    // Mark which of these videos the signed-in viewer has liked.
    let likedIds = new Set();
    if (req.user) {
      const likes = await Like.find({
        user: req.user.id,
        video: { $in: page.map((video) => video._id) },
      }).select("video");
      likedIds = new Set(likes.map((like) => like.video.toString()));
    }

    const body = {
      videos: page.map((video) => toResponse(video, likedIds.has(video._id.toString()))),
      hasMore,
    };
    if (req.query.user) {
      body.total = await Video.countDocuments({ user: req.query.user });
    }

    res.json(body);
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Video not found" });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    if (video.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own videos" });
    }

    await video.deleteOne();
    await Promise.all([
      Like.deleteMany({ video: video._id }),
      Comment.deleteMany({ video: video._id }),
    ]);
    fs.unlink(path.join(__dirname, "..", "uploads", video.filename), () => {});
    res.json({ message: "Video deleted" });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};
