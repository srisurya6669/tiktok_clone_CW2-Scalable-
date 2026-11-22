const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    filename: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    // Filled in the background after upload by Azure AI Vision (tags) and AI Speech (subtitles).
    aiStatus: { type: String, enum: ["pending", "done", "failed"], default: "pending" },
    tags: [String],
    transcript: String,
    captions: [{ _id: false, start: Number, end: Number, text: String }],
  },
  { timestamps: true }
);

// Feed pages (newest first) and a user's own videos on the profile page.
videoSchema.index({ createdAt: -1, _id: -1 });
videoSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Video", videoSchema);
