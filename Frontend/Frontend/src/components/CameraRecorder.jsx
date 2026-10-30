import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 30;

// Prefer MP4 (plays everywhere), then WebM.
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) || ""
  );
}

function formatTime(seconds) {
  return `0:${String(seconds).padStart(2, "0")}`;
}

// Records up to 30 seconds from the camera and hands the result to the
// parent as a File (or null when the recording is discarded).
function CameraRecorder({ onRecorded }) {
  const [status, setStatus] = useState("idle"); // idle | live | recording | recorded
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState(null);

  const liveRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const urlRef = useRef(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Show the live camera in the preview element.
  useEffect(() => {
    if ((status === "live" || status === "recording") && liveRef.current) {
      liveRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  // Release the camera and timers when the component goes away.
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  async function openCamera() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || pickMimeType() === null) {
      setError("Recording is not supported in this browser.");
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: true,
      });
      setStatus("live");
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera and microphone in your browser settings."
          : err.name === "NotFoundError"
            ? "No camera or microphone was found."
            : "Could not open the camera."
      );
    }
  }

  function startRecording() {
    const mimeType = pickMimeType();
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 2_500_000,
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      // Keep only "video/webm", not the ";codecs=..." part, so the server accepts it.
      const type = (recorder.mimeType || mimeType || "video/webm").split(";")[0];
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `recording-${Date.now()}.${extension}`, {
        type,
      });

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecordedUrl(url);
      setStatus("recorded");
      stopStream();
      onRecorded(file);
    };

    const startedAt = Date.now();
    setSeconds(0);
    recorder.start();
    setStatus("recording");

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(Math.min(elapsed, MAX_SECONDS));
      if (elapsed >= MAX_SECONDS) stopRecording();
    }, 250);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function retake() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecordedUrl(null);
    setSeconds(0);
    onRecorded(null);
    openCamera();
  }

  return (
    <div className="recorder">
      {error && (
        <p className="form-message error" role="status">
          {error}
        </p>
      )}

      {status === "idle" && (
        <button
          className="modal-cancel"
          type="button"
          onClick={openCamera}
        >
          Open camera
        </button>
      )}

      {(status === "live" || status === "recording") && (
        <>
          <div className="recorder-screen">
            <video
              ref={liveRef}
              className="recorder-live"
              autoPlay
              muted
              playsInline
            />
            {status === "recording" && (
              <span className="recorder-timer">
                ● {formatTime(seconds)} / {formatTime(MAX_SECONDS)}
              </span>
            )}
          </div>

          {status === "live" ? (
            <button
              className="login-button"
              type="button"
              onClick={startRecording}
            >
              Start recording (max {MAX_SECONDS}s)
            </button>
          ) : (
            <button
              className="login-button"
              type="button"
              onClick={stopRecording}
            >
              Stop
            </button>
          )}
        </>
      )}

      {status === "recorded" && (
        <>
          <div className="recorder-screen">
            <video src={recordedUrl} controls playsInline />
          </div>
          <button
            className="modal-cancel"
            type="button"
            onClick={retake}
          >
            Retake
          </button>
        </>
      )}
    </div>
  );
}

export default CameraRecorder;
