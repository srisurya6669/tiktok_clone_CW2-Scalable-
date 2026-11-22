import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CameraRecorder from "./CameraRecorder";

// A fake camera stream whose facing mode we control, with trackable stop() calls.
function fakeStream(facingMode) {
  const track = { stop: vi.fn(), getSettings: () => (facingMode ? { facingMode } : {}) };
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}

const camera = (kind = "videoinput") => ({ kind });

function setupMedia({ devices = [camera(), camera(), camera("audioinput")], getUserMedia }) {
  vi.stubGlobal(
    "MediaRecorder",
    Object.assign(class {}, { isTypeSupported: (type) => type === "video/mp4" })
  );
  const mediaDevices = {
    getUserMedia: vi.fn(getUserMedia),
    enumerateDevices: vi.fn(async () => devices),
  };
  Object.defineProperty(navigator, "mediaDevices", { value: mediaDevices, configurable: true });
  return mediaDevices;
}

const requestedFacing = (mediaDevices, call) =>
  mediaDevices.getUserMedia.mock.calls[call][0].video.facingMode.ideal;

async function openCamera() {
  render(<CameraRecorder onRecorded={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Open camera" }));
  await screen.findByRole("button", { name: /Start recording/ });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete navigator.mediaDevices;
});

describe("CameraRecorder camera switching", () => {
  let streams;
  beforeEach(() => {
    streams = [];
  });

  it("opens the front camera first and mirrors the preview", async () => {
    const media = setupMedia({
      getUserMedia: async ({ video }) => {
        const stream = fakeStream(video.facingMode.ideal);
        streams.push(stream);
        return stream;
      },
    });
    await openCamera();

    expect(requestedFacing(media, 0)).toBe("user");
    expect(document.querySelector(".recorder-screen video")).toHaveClass("recorder-live");
    expect(screen.getByRole("button", { name: "Switch to back camera" })).toBeEnabled();
  });

  it("switches to the back camera, releases the front one and stops mirroring", async () => {
    const media = setupMedia({
      getUserMedia: async ({ video }) => {
        const stream = fakeStream(video.facingMode.ideal);
        streams.push(stream);
        return stream;
      },
    });
    await openCamera();

    await userEvent.click(screen.getByRole("button", { name: "Switch to back camera" }));

    expect(await screen.findByRole("button", { name: "Switch to front camera" })).toBeInTheDocument();
    expect(requestedFacing(media, 1)).toBe("environment");
    expect(streams[0].track.stop).toHaveBeenCalled();
    expect(document.querySelector(".recorder-screen video")).not.toHaveClass("recorder-live");

    // And back again.
    await userEvent.click(screen.getByRole("button", { name: "Switch to front camera" }));
    expect(await screen.findByRole("button", { name: "Switch to back camera" })).toBeInTheDocument();
    expect(requestedFacing(media, 2)).toBe("user");
    expect(document.querySelector(".recorder-screen video")).toHaveClass("recorder-live");
  });

  it("hides the switch button when the device has only one camera", async () => {
    setupMedia({
      devices: [camera(), camera("audioinput")],
      getUserMedia: async () => fakeStream("user"),
    });
    await openCamera();
    expect(screen.queryByRole("button", { name: /Switch to/ })).toBeNull();
  });

  it("stays on the current camera and says so when the other one cannot be opened", async () => {
    let calls = 0;
    setupMedia({
      getUserMedia: async () => {
        calls += 1;
        if (calls === 2) throw Object.assign(new Error("no back camera"), { name: "OverconstrainedError" });
        return fakeStream("user");
      },
    });
    await openCamera();

    await userEvent.click(screen.getByRole("button", { name: "Switch to back camera" }));

    expect(await screen.findByText("Could not switch camera.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start recording/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to back camera" })).toBeEnabled();
  });

  it("treats a camera without a facing mode (laptop webcam) as the front camera", async () => {
    setupMedia({ getUserMedia: async () => fakeStream(undefined) });
    await openCamera();
    expect(document.querySelector(".recorder-screen video")).toHaveClass("recorder-live");
    expect(screen.getByRole("button", { name: "Switch to back camera" })).toBeInTheDocument();
  });
});
