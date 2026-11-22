const mongoose = require("mongoose");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");
const { analyze } = require("../Services/sentiment");
const language = require("../Services/language");
const contentSafety = require("../Services/contentSafety");
const translator = require("../Services/translator");

const commentToResponse = (comment) => ({
  id: comment._id,
  text: comment.text,
  sentiment: comment.sentiment ?? null,
  language: comment.language ?? null,
  keyPhrases: comment.keyPhrases ?? [],
  redacted: comment.redacted ?? false,
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

    // Overall mood of all comments on this video, shown above the list.
    const counts = await Comment.aggregate([
      { $match: { video: video._id, sentiment: { $exists: true } } },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } },
    ]);
    const sentimentSummary = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    counts.forEach(({ _id, count }) => {
      sentimentSummary[_id] = count;
    });

    // Most mentioned topics across all comments on this video.
    const topics = await Comment.aggregate([
      { $match: { video: video._id } },
      { $unwind: "$keyPhrases" },
      { $group: { _id: { $toLower: "$keyPhrases" }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ]);

    const comments = await Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("user", "name");

    res.json({
      comments: comments.slice(0, limit).map(commentToResponse),
      hasMore: comments.length > limit,
      sentimentSummary,
      topTopics: topics.map(({ _id, count }) => ({ phrase: _id, count })),
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

    // 1. Moderation: harmful comments are rejected before anything is saved.
    const safety = await contentSafety.check(text);
    if (safety?.blocked) {
      return res.status(422).json({
        message: "Your comment was blocked because it may contain harmful content",
        categories: safety.categories,
      });
    }

    // 2. Mask personal details so they are never stored or shown.
    const pii = await language.redactPii(text);
    const safeText = pii?.text ?? text;

    // 3. Analyse the cleaned text. Each call fails soft, so the comment posts even if one is down.
    const [sentiment, detectedLanguage, keyPhrases] = await Promise.all([
      analyze(safeText),
      language.detectLanguage(safeText),
      language.keyPhrases(safeText),
    ]);

    const comment = await Comment.create({
      video: video._id,
      user: req.user.id,
      text: safeText,
      redacted: pii?.redacted ?? false,
      ...(detectedLanguage && { language: detectedLanguage }),
      ...(keyPhrases && { keyPhrases }),
      ...(sentiment && {
        sentiment: sentiment.label,
        sentimentScores: sentiment.scores,
      }),
    });
    await Video.findByIdAndUpdate(video._id, { $inc: { commentsCount: 1 } });
    await comment.populate("user", "name");

    res.status(201).json({ comment: commentToResponse(comment) });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
};

// Translates one comment on demand into the language the viewer asks for.
exports.translateComment = async (req, res) => {
  try {
    const video = await findVideo(req, res);
    if (!video) return;

    const target = String(req.body.to || "").trim();
    if (!/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(target)) {
      return res.status(400).json({ message: "Invalid target language" });
    }
    if (!mongoose.isValidObjectId(req.params.commentId)) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const comment = await Comment.findOne({ _id: req.params.commentId, video: video._id });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const result = await translator.translate(comment.text, target);
    if (!result) {
      return res.status(503).json({ message: "Translation is unavailable right now" });
    }
    res.json({ text: result.text, from: result.from ?? comment.language ?? null, to: target });
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
