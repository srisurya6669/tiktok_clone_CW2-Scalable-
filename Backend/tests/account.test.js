const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  app,
  blobStorage,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  auth,
} = require("./helpers");
const User = require("../Models/userModel");
const Video = require("../Models/videoModel");
const Like = require("../Models/likeModel");
const Comment = require("../Models/commentModel");

before(startDatabase);
afterEach(clearDatabase);
after(stopDatabase);

const PASSWORD = "password123";

async function uploadVideo(user, title) {
  const urlRes = await request(app)
    .post("/api/videos/upload-url")
    .set(auth(user))
    .send({ contentType: "video/mp4" });
  const res = await request(app)
    .post("/api/videos")
    .set(auth(user))
    .send({ title, blobName: urlRes.body.blobName });
  return res.body.video;
}

const like = (user, video) => request(app).put(`/api/videos/${video.id}/like`).set(auth(user));
const comment = (user, video, text) =>
  request(app).post(`/api/videos/${video.id}/comments`).set(auth(user)).send({ text });
const deleteAccount = (user, password = PASSWORD) =>
  request(app).delete("/api/auth/me").set(auth(user)).send({ password });

describe("DELETE /api/auth/me", () => {
  let alice;
  let bob;

  beforeEach(async () => {
    alice = await createUser("Alice");
    bob = await createUser("Bobby");
  });

  it("requires login", async () => {
    const res = await request(app).delete("/api/auth/me").send({ password: PASSWORD });
    assert.equal(res.status, 401);
  });

  it("requires the password", async () => {
    assert.equal((await request(app).delete("/api/auth/me").set(auth(alice))).status, 400);
    assert.equal((await deleteAccount(alice, "")).status, 400);
  });

  it("refuses a wrong password and deletes nothing", async () => {
    await uploadVideo(alice, "Mine");
    const res = await deleteAccount(alice, "not-the-password");
    assert.equal(res.status, 401);
    assert.equal(await User.countDocuments({ _id: alice.id }), 1);
    assert.equal(await Video.countDocuments({ user: alice.id }), 1);
    assert.equal(blobStorage.deleteBlob.mock.calls.length, 0);
  });

  it("deletes the account, its videos and files, and everything on those videos", async () => {
    const carol = await createUser("Carol");
    const aliceVideo = await uploadVideo(alice, "Alice clip");
    await uploadVideo(alice, "Alice clip 2");
    await like(bob, aliceVideo);
    await comment(bob, aliceVideo, "nice one");
    await comment(carol, aliceVideo, "love it");

    const res = await deleteAccount(alice);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.deleted, { videos: 2, likes: 0, comments: 0, filesNotRemoved: 0 });

    assert.equal(await User.countDocuments({ _id: alice.id }), 0);
    assert.equal(await Video.countDocuments({ user: alice.id }), 0);
    assert.equal(await Like.countDocuments(), 0);
    assert.equal(await Comment.countDocuments(), 0);
    assert.equal(blobStorage.deleteBlob.mock.calls.length, 2);
  });

  it("removes the user's likes and comments from other videos and fixes the counters", async () => {
    const carol = await createUser("Carol");
    const bobVideo = await uploadVideo(bob, "Bob clip");
    await like(alice, bobVideo);
    await like(carol, bobVideo);
    await comment(alice, bobVideo, "first");
    await comment(alice, bobVideo, "second");
    await comment(carol, bobVideo, "from carol");

    const res = await deleteAccount(alice);
    assert.deepEqual(res.body.deleted, { videos: 0, likes: 1, comments: 2, filesNotRemoved: 0 });

    const stored = await Video.findById(bobVideo.id);
    assert.equal(stored.likesCount, 1);
    assert.equal(stored.commentsCount, 1);
    assert.equal(await Like.countDocuments({ user: alice.id }), 0);
    assert.equal(await Comment.countDocuments({ user: alice.id }), 0);

    // The other users' activity is untouched.
    const comments = await request(app).get(`/api/videos/${bobVideo.id}/comments`).set(auth(bob));
    assert.deepEqual(comments.body.comments.map((c) => c.text), ["from carol"]);
    assert.equal(await Like.countDocuments({ user: carol.id }), 1);
  });

  it("leaves other users and their videos alone", async () => {
    await uploadVideo(alice, "Alice clip");
    const bobVideo = await uploadVideo(bob, "Bob clip");

    await deleteAccount(alice);

    const feed = await request(app).get("/api/videos").set(auth(bob));
    assert.deepEqual(feed.body.videos.map((v) => v.id), [bobVideo.id]);
    const login = await request(app).post("/api/auth/login").send({ email: bob.email, password: PASSWORD });
    assert.equal(login.status, 200);
  });

  it("stops the old token and the old login from working", async () => {
    await deleteAccount(alice);

    assert.equal((await request(app).get("/api/auth/me").set(auth(alice))).status, 401);
    assert.equal((await request(app).get("/api/videos").set(auth(alice))).status, 401);
    const login = await request(app).post("/api/auth/login").send({ email: alice.email, password: PASSWORD });
    assert.equal(login.status, 401);
  });

  it("still deletes the account when a video file cannot be removed", async () => {
    await uploadVideo(alice, "Alice clip");
    blobStorage.deleteBlob.mock.mockImplementationOnce(async () => {
      throw new Error("storage down");
    });

    const res = await deleteAccount(alice);
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted.filesNotRemoved, 1);
    assert.equal(await User.countDocuments({ _id: alice.id }), 0);
    assert.equal(await Video.countDocuments({ user: alice.id }), 0);
  });

  it("lets the same email sign up again afterwards", async () => {
    await deleteAccount(alice);
    const again = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice", email: alice.email, password: PASSWORD });
    assert.equal(again.status, 201);
  });
});
