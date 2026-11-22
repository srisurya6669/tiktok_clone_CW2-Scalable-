import { useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, VolumeIcon } from "./Icons";

// Shared player: no native controls, click to play/pause, mute button in the
// top-right corner and a thin progress bar along the bottom. `children` are
// overlaid on top of the video (title, like button, etc.).
// WebVTT timestamp, e.g. 83.5 -> "00:01:23.500".
function vttTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60
  )}.${pad(ms % 1000, 3)}`;
}

// Subtitles (from Azure AI Speech) as an inline WebVTT file the <video> can show.
function subtitleUrl(captions) {
  if (!captions?.length) return null;
  const cues = captions
    .map((cue) => `${vttTime(cue.start)} --> ${vttTime(cue.end)}\n${cue.text}`)
    .join("\n\n");
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n${cues}\n`)}`;
}

function VideoPlayer({ src, title, captions, autoPlayInView = false, onActiveChange, children }) {
  const videoRef = useRef(null);
  const subtitlesSrc = useMemo(() => subtitleUrl(captions), [captions]);
  const [paused, setPaused] = useState(true);
  // Autoplay needs the video muted; click-to-play can start with sound.
  const [muted, setMuted] = useState(autoPlayInView);
  const [progress, setProgress] = useState(0);
  const [fit, setFit] = useState("cover");

  // Feed mode: play only the video that is mostly on screen.
  useEffect(() => {
    if (!autoPlayInView) return;

    const element = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onActiveChange?.(entry.isIntersecting);
        if (entry.isIntersecting) {
          element.play().catch(() => {});
        } else {
          element.pause();
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [autoPlayInView, onActiveChange]);

  function togglePlay() {
    const element = videoRef.current;
    if (element.paused) element.play().catch(() => {});
    else element.pause();
  }

  function handleKeyDown(event) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePlay();
    }
  }

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        className={`fit-${fit}`}
        src={src}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        tabIndex={0}
        aria-label={`${title} (click to play or pause)`}
        onClick={togglePlay}
        onKeyDown={handleKeyDown}
        onLoadedMetadata={(event) => {
          // Portrait videos fill the frame; wider ones are shown whole.
          const { videoWidth, videoHeight } = event.target;
          setFit(videoWidth / videoHeight > 0.75 ? "contain" : "cover");
        }}
        onPlay={(event) => {
          setPaused(false);
          // Only one video plays at a time.
          document.querySelectorAll("video").forEach((other) => {
            if (other !== event.target) other.pause();
          });
        }}
        onPause={() => setPaused(true)}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.target;
          setProgress(duration ? (currentTime / duration) * 100 : 0);
        }}
      >
        {subtitlesSrc && (
          <track kind="captions" label="Auto subtitles" srcLang="en" src={subtitlesSrc} default />
        )}
      </video>

      {paused && (
        <div className="play-indicator" aria-hidden="true">
          <PlayIcon />
        </div>
      )}

      <button
        className="action-button mute-button"
        onClick={() => setMuted((value) => !value)}
        aria-pressed={!muted}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        <VolumeIcon muted={muted} />
      </button>

      {children}

      <div className="video-progress" aria-hidden="true">
        <div style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default VideoPlayer;
