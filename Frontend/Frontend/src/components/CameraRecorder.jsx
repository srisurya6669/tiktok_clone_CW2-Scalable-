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
  // Which camera is open: "user" is the front (selfie) camera, "environment" the back one.
  const [facing, setFacing] = useState("user");
  const [canSwitch, setCanSwitch] = useState(false);
  const [switching, setSwitching] = useState(false);
  // Bumped for every new stream so the preview picks it up.
  const [streamVersion, setStreamVersion] = useState(0);

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
  }, [status, streamVersion]);

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

  // Opens the front ("user") or back ("environment") camera. Returns true on success.
  async function openCamera(wanted = facing) {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || pickMimeType() === null) {
      setError("Recording is not supported in this browser.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: wanted },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: true,
      });
      streamRef.current = stream;

      // A laptop webcam has no facing mode; treat it as the front camera.
      setFacing(stream.getVideoTracks()[0]?.getSettings?.().facingMode || "user");
      setStreamVersion((version) => version + 1);
      setStatus("live");

      // Device names are only listed after permission is granted, so check now.
      const devices = (await navigator.mediaDevices.enumerateDevices?.()) || [];
      setCanSwitch(devices.filter((device) => device.kind === "videoinput").length > 1);
      return true;
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera and microphone in your browser settings."
          : err.name === "NotFoundError"
            ? "No camera or microphone was found."
            : "Could not open the camera."
      );
      return false;
    }
  }

  // Swap between the front and back camera while previewing (not while recording).
  async function switchCamera() {
    const previous = facing;
    const next = previous === "user" ? "environment" : "user";
    setSwitching(true);

    // Phones usually cannot open two cameras at once, so release the current one first.
    stopStream();
    if (!(await openCamera(next))) {
      // Could not open the other camera: go back to the one that worked.
      const restored = await openCamera(previous);
      if (restored) setError("Could not switch camera.");
      else setStatus("idle");
    }
    setSwitching(false);
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
          onClick={() => openCamera()}
        >
          Open camera
        </button>
      )}

      {(status === "live" || status === "recording") && (
        <>
          <div className="recorder-screen">
            <video
              ref={liveRef}
              // Only the selfie camera is mirrored, like a mirror; the back camera is not.
              className={facing === "user" ? "recorder-live" : ""}
              autoPlay
              muted
              playsInline
            />
            {status === "live" && canSwitch && (
              <button
                className="recorder-switch"
                type="button"
                onClick={switchCamera}
                disabled={switching}
                aria-label={
                  facing === "user" ? "Switch to back camera" : "Switch to front camera"
                }
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 7h-3.2l-1.4-2H8.6L7.2 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" />
                  <path d="M9.5 13a2.7 2.7 0 0 1 4.6-1.9M14.5 13a2.7 2.7 0 0 1-4.6 1.9M14.2 9.6v1.6h-1.6M9.8 16.4v-1.6h1.6" />
                </svg>
              </button>
            )}
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
