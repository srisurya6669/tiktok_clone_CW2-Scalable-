// Removes a user and everything tied to them: their videos (and the files in Blob Storage), all
// likes and comments on those videos, and the likes and comments they left on other people's
// videos (with those videos' counters corrected). The user record goes last, so a failure part
// way through can simply be retried.
const User = require("../Models/userModel");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");
const blobStorage = require("./blobStorage");

// Subtracts a user's likes or comments from the counters of videos that stay behind.
async function fixCounters(Model, userId, counterField) {
  const perVideo = await Model.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$video", count: { $sum: 1 } } },
  ]);
  if (perVideo.length > 0) {
    await Video.bulkWrite(
      perVideo.map(({ _id, count }) => ({
        updateOne: { filter: { _id }, update: { $inc: { [counterField]: -count } } },
      }))
    );
  }
  return Model.deleteMany({ user: userId });
}

exports.deleteAccount = async (userId) => {
  const videos = await Video.find({ user: userId }).select("_id filename");
  const videoIds = videos.map((video) => video._id);

  // 1. The user's own videos, with everything other people did on them.
  await Promise.all([
    Like.deleteMany({ video: { $in: videoIds } }),
    Comment.deleteMany({ video: { $in: videoIds } }),
  ]);
  await Video.deleteMany({ _id: { $in: videoIds } });
  // A file that cannot be removed must not block the deletion; it only costs a little storage.
  const blobResults = await Promise.allSettled(videos.map((video) => blobStorage.deleteBlob(video.filename)));

  // 2. What the user left on other people's videos. Their own videos are gone by now, so every
  // remaining like and comment belongs to a video that stays.
  const [likes, comments] = await Promise.all([
    fixCounters(Like, userId, "likesCount"),
    fixCounters(Comment, userId, "commentsCount"),
  ]);

  // 3. The account itself.
  await User.deleteOne({ _id: userId });

  return {
    videos: videos.length,
    likes: likes.deletedCount,
    comments: comments.deletedCount,
    filesNotRemoved: blobResults.filter((result) => result.status === "rejected").length,
  };
};
