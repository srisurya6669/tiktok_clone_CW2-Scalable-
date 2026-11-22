// Background AI analysis of a newly uploaded video: tags from Azure AI Vision and subtitles from
// Azure AI Speech. It runs after the upload response is sent, and never throws.
const Video = require("../Models/videoModel");
const blobStorage = require("./blobStorage");
const media = require("./media");
const vision = require("./vision");
const speech = require("./speech");

async function tags(url) {
  if (!vision.isConfigured) return null;
  const frame = await media.extractFrame(url);
  return frame ? vision.tagImage(frame) : null;
}

async function subtitles(url) {
  if (!speech.isConfigured) return null;
  const audio = await media.extractAudio(url);
  return audio ? speech.transcribe(audio) : null;
}

exports.analyzeVideo = async (video) => {
  try {
    const url = await blobStorage.readUrl(video.filename);
    const [videoTags, subs] = await Promise.all([
      tags(url).catch((error) => console.error("Frame tagging failed:", error.message)),
      subtitles(url).catch((error) => console.error("Subtitles failed:", error.message)),
    ]);

    await Video.findByIdAndUpdate(video._id, {
      aiStatus: "done",
      ...(videoTags && { tags: videoTags }),
      ...(subs && { transcript: subs.transcript, captions: subs.captions }),
    });
  } catch (error) {
    console.error("Video analysis failed:", error.message);
    await Video.findByIdAndUpdate(video._id, { aiStatus: "failed" }).catch(() => {});
  }
};
