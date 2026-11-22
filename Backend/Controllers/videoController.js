const mongoose = require("mongoose");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");
const blobStorage = require("../Services/blobStorage");
const { analyzeVideo } = require("../Services/videoAnalysis");

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

// Browser recordings send types like "video/webm;codecs=vp9,opus"; ignore the codec part.
const baseType = (type = "") => type.split(";")[0];

const toResponse = async (video, liked = false) => ({
  id: video._id,
  title: video.title,
  author: video.user?.name,
  userId: video.user?._id,
  src: await blobStorage.readUrl(video.filename),
  likesCount: video.likesCount ?? 0,
  commentsCount: video.commentsCount ?? 0,
  aiStatus: video.aiStatus ?? "done",
  tags: video.tags ?? [],
  transcript: video.transcript ?? null,
  captions: video.captions ?? [],
  liked,
  createdAt: video.createdAt,
});

// Step 1: hand the browser a short-lived URL to upload straight to Blob Storage.
exports.uploadUrl = async (req, res) => {
  const contentType = baseType(req.body.contentType);
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) {
    return res
      .status(400)
      .json({ message: "Only MP4, WebM or MOV videos are allowed" });
  }

  const blobName = blobStorage.newBlobName(req.user.id, extension);
  try {
    const uploadUrl = await blobStorage.uploadUrl(blobName);
    res.json({ uploadUrl, blobName, contentType });
  } catch {
    res.status(500).json({ message: "Could not prepare upload" });
  }
};

// Step 2: after the browser finished uploading, verify the blob and save its metadata.
exports.upload = async (req, res) => {
  const { blobName } = req.body;
  if (!blobStorage.isOwnBlob(blobName, req.user.id)) {
    return res.status(400).json({ message: "Invalid upload" });
  }

  try {
    let properties;
    try {
      properties = await blobStorage.getProperties(blobName);
    } catch {
      return res.status(400).json({ message: "Video file was not uploaded" });
    }

    if (
      properties.contentLength > MAX_VIDEO_BYTES ||
      !ALLOWED_TYPES[baseType(properties.contentType)]
    ) {
      await blobStorage.deleteBlob(blobName);
      return res
        .status(400)
        .json({ message: "Video must be an MP4, WebM or MOV of 100MB or less" });
    }

    const title = (req.body.title || "").trim() || "Untitled";
    const video = await Video.create({
      title,
      filename: blobName,
      user: req.user.id,
    });
    await video.populate("user", "name");
    res.status(201).json({ video: await toResponse(video) });

    // Tags and subtitles are generated after responding; they appear in the feed once ready.
    analyzeVideo(video);
  } catch (error) {
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
      videos: await Promise.all(
        page.map((video) => toResponse(video, likedIds.has(video._id.toString())))
      ),
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
    await blobStorage.deleteBlob(video.filename).catch(() => {});
    res.json({ message: "Video deleted" });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};
