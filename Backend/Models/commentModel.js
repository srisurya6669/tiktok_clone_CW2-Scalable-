const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    // Filled in by Azure AI Language; stays empty if the service is unavailable.
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative", "mixed"],
    },
    sentimentScores: {
      positive: Number,
      neutral: Number,
      negative: Number,
    },
    // Also from Azure AI Language: detected language and the main topics of the comment.
    language: String,
    keyPhrases: [String],
    // True when personal details (email, phone, card, IP) were masked before saving.
    redacted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

commentSchema.index({ video: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);
