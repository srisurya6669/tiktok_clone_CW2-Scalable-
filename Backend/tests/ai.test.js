const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  app,
  language,
  contentSafety,
  translator,
  videoAnalysis,
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

const post = (user, text) =>
  request(app).post(`/api/videos/${video.id}/comments`).set(auth(user)).send({ text });

describe("content moderation", () => {
  it("blocks a harmful comment and does not save it", async () => {
    contentSafety.check.mock.mockImplementationOnce(async () => ({ blocked: true, categories: ["Hate"] }));
    const res = await post(viewer, "something awful");
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.categories, ["Hate"]);

    const list = await request(app).get(`/api/videos/${video.id}/comments`).set(auth(viewer));
    assert.equal(list.body.comments.length, 0);
    const feed = await request(app).get("/api/videos").set(auth(viewer));
    assert.equal(feed.body.videos[0].commentsCount, 0);
  });

  it("allows a comment that passes moderation", async () => {
    contentSafety.check.mock.mockImplementationOnce(async () => ({ blocked: false, categories: [] }));
    assert.equal((await post(viewer, "nice")).status, 201);
  });

  it("still posts when Content Safety is unavailable", async () => {
    assert.equal((await post(viewer, "hello")).status, 201);
  });
});

describe("language analysis", () => {
  it("masks personal details before saving", async () => {
    language.redactPii.mock.mockImplementationOnce(async () => ({
      text: "call me on ***********",
      redacted: true,
    }));
    const res = await post(viewer, "call me on 07123456789");
    assert.equal(res.body.comment.text, "call me on ***********");
    assert.equal(res.body.comment.redacted, true);
    assert.equal(language.detectLanguage.mock.calls[0].arguments[0], "call me on ***********");
  });

  it("saves the detected language and key phrases", async () => {
    language.detectLanguage.mock.mockImplementationOnce(async () => "fr");
    language.keyPhrases.mock.mockImplementationOnce(async () => ["belle plage"]);
    const res = await post(viewer, "Quelle belle plage");
    assert.equal(res.body.comment.language, "fr");
    assert.deepEqual(res.body.comment.keyPhrases, ["belle plage"]);
    assert.equal(res.body.comment.redacted, false);
  });

  it("lists the top topics across comments", async () => {
    language.keyPhrases.mock.mockImplementationOnce(async () => ["Beach", "sunset"], 0);
    language.keyPhrases.mock.mockImplementationOnce(async () => ["beach"], 1);
    await post(viewer, "one");
    await post(owner, "two");

    const res = await request(app).get(`/api/videos/${video.id}/comments`).set(auth(viewer));
    assert.deepEqual(res.body.topTopics[0], { phrase: "beach", count: 2 });
    assert.equal(res.body.topTopics.length, 2);
  });

  it("posts a plain comment when every language service is down", async () => {
    const res = await post(viewer, "plain");
    assert.equal(res.status, 201);
    assert.equal(res.body.comment.text, "plain");
    assert.equal(res.body.comment.language, null);
    assert.deepEqual(res.body.comment.keyPhrases, []);
  });
});

describe("translation", () => {
  const translate = (commentId, to) =>
    request(app)
      .post(`/api/videos/${video.id}/comments/${commentId}/translate`)
      .set(auth(owner))
      .send({ to });

  it("translates a comment into the requested language", async () => {
    const { body } = await post(viewer, "Love this");
    translator.translate.mock.mockImplementationOnce(async () => ({ text: "J'adore ça", from: "en" }));
    const res = await translate(body.comment.id, "fr");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { text: "J'adore ça", from: "en", to: "fr" });
    assert.deepEqual(translator.translate.mock.calls[0].arguments, ["Love this", "fr"]);
  });

  it("returns 503 when translation is unavailable", async () => {
    const { body } = await post(viewer, "Hi");
    assert.equal((await translate(body.comment.id, "fr")).status, 503);
  });

  it("rejects a bad language code and an unknown comment", async () => {
    const { body } = await post(viewer, "Hi");
    assert.equal((await translate(body.comment.id, "not a language")).status, 400);
    assert.equal((await translate("64b7f0c2a1d3e4f5a6b7c8d9", "fr")).status, 404);
  });

  it("requires login", async () => {
    const { body } = await post(viewer, "Hi");
    const res = await request(app)
      .post(`/api/videos/${video.id}/comments/${body.comment.id}/translate`)
      .send({ to: "fr" });
    assert.equal(res.status, 401);
  });
});

describe("video analysis", () => {
  it("starts the background analysis after an upload", () => {
    assert.equal(videoAnalysis.analyzeVideo.mock.calls.length, 1);
    assert.equal(String(videoAnalysis.analyzeVideo.mock.calls[0].arguments[0]._id), video.id);
  });

  it("returns tags and captions in the feed once they are saved", async () => {
    const Video = require("../Models/videoModel");
    await Video.findByIdAndUpdate(video.id, {
      aiStatus: "done",
      tags: ["beach", "sky"],
      transcript: "hello world",
      captions: [{ start: 0, end: 1.5, text: "hello world" }],
    });
    const feed = await request(app).get("/api/videos").set(auth(viewer));
    const [item] = feed.body.videos;
    assert.equal(item.aiStatus, "done");
    assert.deepEqual(item.tags, ["beach", "sky"]);
    assert.deepEqual(item.captions, [{ start: 0, end: 1.5, text: "hello world" }]);
  });
});
