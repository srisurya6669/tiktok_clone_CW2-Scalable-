import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadModal from "./UploadModal";
import { mockFetch } from "../test/fetchMock";

const videoFile = (size = 1024) => {
  const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

async function chooseFileAndUpload(file) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Title"), "My clip");
  const input = document.querySelector('input[type="file"]');
  await user.upload(input, file);
  // Submit the form directly: jsdom treats a required file input as empty even after upload.
  fireEvent.submit(screen.getByRole("button", { name: "Upload" }).closest("form"));
}

describe("UploadModal", () => {
  it("uploads straight to Blob Storage, then saves the video", async () => {
    const saved = { id: "v1", title: "My clip" };
    const fetchMock = mockFetch([
      ["POST", "/api/videos/upload-url", () => ({
        body: { uploadUrl: "https://blob.test/videos/u1/a.mp4?sig=1", blobName: "u1/a.mp4", contentType: "video/mp4" },
      })],
      ["PUT", "https://blob.test/videos/u1/a.mp4", () => ({ status: 201 })],
      ["POST", "/api/videos", () => ({ status: 201, body: { video: saved } })],
    ]);
    const onUploaded = vi.fn();
    const onClose = vi.fn();
    render(<UploadModal token="jwt" onClose={onClose} onUploaded={onUploaded} />);

    await chooseFileAndUpload(videoFile());

    await vi.waitFor(() => expect(onUploaded).toHaveBeenCalledWith(saved));
    expect(onClose).toHaveBeenCalled();

    const [urlCall, putCall, saveCall] = fetchMock.mock.calls;
    expect(JSON.parse(urlCall[1].body)).toEqual({ contentType: "video/mp4" });
    expect(putCall[1].headers["x-ms-blob-type"]).toBe("BlockBlob");
    expect(putCall[1].headers.Authorization).toBeUndefined();
    expect(JSON.parse(saveCall[1].body)).toEqual({ title: "My clip", blobName: "u1/a.mp4" });
  });

  it("refuses files over 100MB without contacting the server", async () => {
    const fetchMock = mockFetch([]);
    render(<UploadModal token="jwt" onClose={vi.fn()} onUploaded={vi.fn()} />);

    await chooseFileAndUpload(videoFile(101 * 1024 * 1024));

    expect(await screen.findByRole("status")).toHaveTextContent("100MB or smaller");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a failed upload to storage", async () => {
    mockFetch([
      ["POST", "/api/videos/upload-url", () => ({
        body: { uploadUrl: "https://blob.test/x?sig=1", blobName: "u1/x.mp4", contentType: "video/mp4" },
      })],
      ["PUT", "https://blob.test/x", () => ({ status: 403, body: "<Error><Code>AuthenticationFailed</Code></Error>" })],
    ]);
    const onUploaded = vi.fn();
    render(<UploadModal token="jwt" onClose={vi.fn()} onUploaded={onUploaded} />);

    await chooseFileAndUpload(videoFile());

    expect(await screen.findByRole("status")).toHaveTextContent("403 AuthenticationFailed");
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
