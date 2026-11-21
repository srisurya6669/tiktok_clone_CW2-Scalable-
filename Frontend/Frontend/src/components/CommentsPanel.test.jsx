import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentsPanel from "./CommentsPanel";
import { mockFetch } from "../test/fetchMock";

const me = { _id: "me", name: "Me" };
const comment = (id, text, sentiment, userId = "someone") => ({
  id,
  text,
  sentiment,
  userId,
  author: userId === "me" ? "Me" : "Someone",
  createdAt: "2026-11-01T10:00:00.000Z",
});

function renderPanel(props = {}) {
  return render(
    <CommentsPanel
      videoId="v1"
      token="jwt"
      user={me}
      active
      commentsCount={2}
      onCountChange={vi.fn()}
      {...props}
    />
  );
}

describe("CommentsPanel", () => {
  it("shows comments with sentiment badges and a summary", async () => {
    mockFetch([
      [
        "GET",
        "/api/videos/v1/comments",
        () => ({
          body: {
            comments: [comment("c1", "Great video", "positive"), comment("c2", "Not for me", "negative")],
            hasMore: false,
            sentimentSummary: { positive: 1, neutral: 0, negative: 1, mixed: 0 },
          },
        }),
      ],
    ]);
    renderPanel();

    const first = (await screen.findByText("Great video")).closest("li");
    expect(within(first).getByText("positive")).toHaveClass("sentiment-badge", "sentiment-positive");
    expect(screen.getByLabelText("Comment sentiment")).toHaveTextContent("1 positive");
    expect(screen.getByLabelText("Comment sentiment")).toHaveTextContent("1 negative");
  });

  it("does not load comments until the video is active", () => {
    const fetchMock = mockFetch([]);
    renderPanel({ active: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a comment and updates the count and summary", async () => {
    const fetchMock = mockFetch([
      ["GET", "/comments", () => ({ body: { comments: [], hasMore: false, sentimentSummary: { positive: 0, neutral: 0, negative: 0, mixed: 0 } } })],
      ["POST", "/comments", () => ({ status: 201, body: { comment: comment("c9", "Love it", "positive", "me") } })],
    ]);
    const onCountChange = vi.fn();
    renderPanel({ onCountChange });
    await screen.findByText(/No comments yet/);

    await userEvent.type(screen.getByPlaceholderText("Add a comment..."), "Love it");
    await userEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText("Love it")).toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(1);
    expect(screen.getByLabelText("Comment sentiment")).toHaveTextContent("1 positive");
    const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(postCall[1].body)).toEqual({ text: "Love it" });
    expect(postCall[1].headers.Authorization).toBe("Bearer jwt");
  });

  it("only offers Delete on the user's own comments", async () => {
    mockFetch([
      [
        "GET",
        "/comments",
        () => ({
          body: {
            comments: [comment("c1", "Mine", null, "me"), comment("c2", "Theirs", null)],
            hasMore: false,
          },
        }),
      ],
    ]);
    renderPanel();

    const mine = (await screen.findByText("Mine")).closest("li");
    const theirs = screen.getByText("Theirs").closest("li");
    expect(within(mine).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(theirs).queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
