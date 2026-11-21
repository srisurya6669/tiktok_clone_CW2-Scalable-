const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  app,
  sentiment,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  auth,
} = require("./helpers");

before(startDatabase);
afterEach(clearDatabase);
after(stopDatabase);

let owner;
let viewer;
let video;

beforeEach(async () => {
  owner = await createUser("Owner");
  viewer = await createUser("Viewer");
  const { body } = await request(app)
    .post("/api/videos/upload-url")
    .set(auth(owner))
    .send({ contentType: "video/mp4" });
  const res = await request(app)
    .post("/api/videos")
    .set(auth(owner))
    .send({ title: "Clip", blobName: body.blobName });
  video = res.body.video;
});

// Makes the fake Azure AI Language return these labels, one per call, in order.
function sentimentReturns(...labels) {
  labels.forEach((label, index) =>
    sentiment.analyze.mock.mockImplementationOnce(
      async () => (label ? { label, scores: { positive: 0, neutral: 0, negative: 0 } } : null),
      index
    )
  );
}

describe("likes", () => {
  it("likes once per user and shows it as liked", async () => {
    await request(app).put(`/api/videos/${video.id}/like`).set(auth(viewer));
    const again = await request(app).put(`/api/videos/${video.id}/like`).set(auth(viewer));
    assert.deepEqual(again.body, { liked: true, likesCount: 1 });

    const feed = await request(app).get("/api/videos").set(auth(viewer));
    assert.equal(feed.body.videos[0].liked, true);
    assert.equal(feed.body.videos[0].likesCount, 1);

    const ownerFeed = await request(app).get("/api/videos").set(auth(owner));
    assert.equal(ownerFeed.body.videos[0].liked, false);
  });

  it("unlikes", async () => {
    await request(app).put(`/api/videos/${video.id}/like`).set(auth(viewer));
    const res = await request(app).delete(`/api/videos/${video.id}/like`).set(auth(viewer));
    assert.deepEqual(res.body, { liked: false, likesCount: 0 });
  });

  it("returns 404 for an unknown video", async () => {
    const res = await request(app)
      .put("/api/videos/64b7f0c2a1d3e4f5a6b7c8d9/like")
      .set(auth(viewer));
    assert.equal(res.status, 404);
  });
});

describe("comments", () => {
  const post = (user, text) =>
    request(app).post(`/api/videos/${video.id}/comments`).set(auth(user)).send({ text });

  it("saves the sentiment from Azure AI Language", async () => {
    sentimentReturns("positive");
    const res = await post(viewer, "Love this!");
    assert.equal(res.status, 201);
    assert.equal(res.body.comment.text, "Love this!");
    assert.equal(res.body.comment.author, "Viewer");
    assert.equal(res.body.comment.sentiment, "positive");
    assert.equal(sentiment.analyze.mock.calls[0].arguments[0], "Love this!");
  });

  it("still posts the comment when sentiment analysis is unavailable", async () => {
    const res = await post(viewer, "Hello");
    assert.equal(res.status, 201);
    assert.equal(res.body.comment.sentiment, null);
  });

  it("returns comments newest first with a sentiment summary", async () => {
    sentimentReturns("positive", "negative", "positive");
    await post(viewer, "one");
    await post(viewer, "two");
    await post(owner, "three");

    const res = await request(app).get(`/api/videos/${video.id}/comments`).set(auth(viewer));
    assert.deepEqual(res.body.comments.map((c) => c.text), ["three", "two", "one"]);
    assert.deepEqual(res.body.sentimentSummary, { positive: 2, neutral: 0, negative: 1, mixed: 0 });

    const feed = await request(app).get("/api/videos").set(auth(viewer));
    assert.equal(feed.body.videos[0].commentsCount, 3);
  });

  it("rejects empty and over-long comments", async () => {
    assert.equal((await post(viewer, "   ")).status, 400);
    assert.equal((await post(viewer, "x".repeat(501))).status, 400);
    assert.equal(sentiment.analyze.mock.callCount(), 0);
  });

  it("lets only the author delete a comment", async () => {
    const { body } = await post(viewer, "mine");
    const url = `/api/videos/${video.id}/comments/${body.comment.id}`;

    assert.equal((await request(app).delete(url).set(auth(owner))).status, 403);
    assert.equal((await request(app).delete(url).set(auth(viewer))).status, 200);

    const feed = await request(app).get("/api/videos").set(auth(viewer));
    assert.equal(feed.body.videos[0].commentsCount, 0);
  });

  it("removes likes and comments when the video is deleted", async () => {
    await post(viewer, "bye");
    await request(app).delete(`/api/videos/${video.id}`).set(auth(owner));
    const res = await request(app).get(`/api/videos/${video.id}/comments`).set(auth(viewer));
    assert.equal(res.status, 404);
  });
});
