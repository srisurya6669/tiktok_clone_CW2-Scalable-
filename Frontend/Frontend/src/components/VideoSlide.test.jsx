import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VideoSlide from "./VideoSlide";
import { mockFetch } from "../test/fetchMock";

const baseVideo = {
  id: "v1",
  title: "Beach day",
  author: "Sam",
  src: "https://storage.test/v1.mp4",
  likesCount: 0,
  commentsCount: 0,
  liked: false,
};

function renderSlide(video) {
  mockFetch([]);
  return render(<VideoSlide video={{ ...baseVideo, ...video }} user={{ _id: "me" }} token="jwt" />);
}

describe("VideoSlide AI features", () => {
  // jsdom has no IntersectionObserver, which the player uses to autoplay the visible video.
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  it("shows the AI-generated tags as hashtags", () => {
    renderSlide({ tags: ["beach", "blue sky"] });
    const tags = screen.getByLabelText("AI-generated tags");
    expect(tags).toHaveTextContent("#beach");
    expect(tags).toHaveTextContent("#bluesky");
  });

  it("adds an auto-subtitle track as WebVTT when captions exist", () => {
    const { container } = renderSlide({ captions: [{ start: 0, end: 1.5, text: "hello there" }] });
    const track = container.querySelector("track");
    expect(track).toHaveAttribute("kind", "captions");
    const vtt = decodeURIComponent(track.getAttribute("src").split(",")[1]);
    expect(vtt).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nhello there\n");
  });

  it("has no tags or subtitle track while the analysis is still running", () => {
    const { container } = renderSlide({ tags: [], captions: [] });
    expect(screen.queryByLabelText("AI-generated tags")).toBeNull();
    expect(container.querySelector("track")).toBeNull();
  });
});
