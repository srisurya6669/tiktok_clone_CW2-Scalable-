// Pulls a still frame and the audio track out of a video with ffmpeg, reading straight from the
// blob's short-lived read URL and returning the result in memory (no temp files).
const { spawn } = require("child_process");

const FFMPEG_TIMEOUT_MS = 60000;
const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 180;

function run(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-v", "error", "-nostdin", ...args, "pipe:1"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const chunks = [];
    let size = 0;

    const timer = setTimeout(() => ffmpeg.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    ffmpeg.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) return ffmpeg.kill("SIGKILL");
      chunks.push(chunk);
    });
    ffmpeg.on("error", (error) => {
      clearTimeout(timer);
      reject(error); // for example ffmpeg is not installed
    });
    ffmpeg.on("close", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
  });
}

// A JPEG from one second in (or the first frame for very short clips), or null.
exports.extractFrame = async (url) => {
  const frame = (seek) =>
    run(["-ss", seek, "-i", url, "-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2pipe", "-vcodec", "mjpeg"]);
  let image = await frame("1");
  if (!image.length) image = await frame("0");
  return image.length ? image : null;
};

// Mono 16 kHz MP3 of the first few minutes, or null if the video has no sound.
exports.extractAudio = async (url) => {
  const audio = await run([
    "-i", url, "-vn", "-t", String(MAX_AUDIO_SECONDS),
    "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "mp3",
  ]);
  return audio.length ? audio : null;
};
