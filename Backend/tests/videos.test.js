const { describe, it, before, after, afterEach } = require("node:test");
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

before(startDatabase);
afterEach(clearDatabase);
after(stopDatabase);

// Runs the two-step upload (get URL, then save) and returns the saved video.
async function uploadVideo(user, title = "My video") {
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

describe("POST /api/videos/upload-url", () => {
  it("requires login", async () => {
    const res = await request(app).post("/api/videos/upload-url").send({ contentType: "video/mp4" });
    assert.equal(res.status, 401);
  });

  it("returns an upload URL inside the user's own folder", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/videos/upload-url")
      .set(auth(user))
      .send({ contentType: "video/webm;codecs=vp9,opus" });
    assert.equal(res.status, 200);
    assert.match(res.body.blobName, new RegExp(`^${user.id}/.+\\.webm$`));
    assert.equal(res.body.contentType, "video/webm");
    assert.ok(res.body.uploadUrl.includes(res.body.blobName));
  });

  it("rejects files that are not videos", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/videos/upload-url")
      .set(auth(user))
      .send({ contentType: "image/png" });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/videos", () => {
  it("saves the video after the upload", async () => {
    const user = await createUser("Uploader");
    const video = await uploadVideo(user, "Holiday clip");
    assert.equal(video.title, "Holiday clip");
    assert.equal(video.author, "Uploader");
    assert.equal(video.likesCount, 0);
    assert.equal(video.commentsCount, 0);
    assert.equal(video.liked, false);
    assert.ok(video.src.includes("sig=read"));
  });

  it("refuses a blob that belongs to another user", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/videos")
      .set(auth(user))
      .send({ title: "Stolen", blobName: "someone-else/video.mp4" });
    assert.equal(res.status, 400);
  });

  it("refuses when the file was never uploaded", async () => {
    const user = await createUser();
    blobStorage.getProperties.mock.mockImplementationOnce(async () => {
      throw new Error("BlobNotFound");
    });
    const res = await request(app)
      .post("/api/videos")
      .set(auth(user))
      .send({ title: "Missing", blobName: `${user.id}/missing.mp4` });
    assert.equal(res.status, 400);
  });

  it("deletes and refuses a file over 100MB", async () => {
    const user = await createUser();
    blobStorage.getProperties.mock.mockImplementationOnce(async () => ({
      contentLength: 101 * 1024 * 1024,
      contentType: "video/mp4",
    }));
    const blobName = `${user.id}/huge.mp4`;
    const res = await request(app).post("/api/videos").set(auth(user)).send({ title: "Huge", blobName });
    assert.equal(res.status, 400);
    assert.deepEqual(blobStorage.deleteBlob.mock.calls.map((call) => call.arguments[0]), [blobName]);
  });
});

describe("GET /api/videos", () => {
  it("requires login", async () => {
    assert.equal((await request(app).get("/api/videos")).status, 401);
  });

  it("returns newest first and pages with a cursor", async () => {
    const user = await createUser();
    for (const title of ["first", "second", "third"]) await uploadVideo(user, title);

    const page1 = await request(app).get("/api/videos?limit=2").set(auth(user));
    assert.deepEqual(page1.body.videos.map((v) => v.title), ["third", "second"]);
    assert.equal(page1.body.hasMore, true);

    const before = page1.body.videos[1].createdAt;
    const page2 = await request(app)
      .get(`/api/videos?limit=2&before=${encodeURIComponent(before)}`)
      .set(auth(user));
    assert.deepEqual(page2.body.videos.map((v) => v.title), ["first"]);
    assert.equal(page2.body.hasMore, false);
  });

  it("filters by user and returns their total for the profile page", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await uploadVideo(alice, "alice 1");
    await uploadVideo(alice, "alice 2");
    await uploadVideo(bob, "bob 1");

    const res = await request(app).get(`/api/videos?user=${alice.id}`).set(auth(bob));
    assert.equal(res.body.total, 2);
    assert.ok(res.body.videos.every((v) => v.title.startsWith("alice")));
  });

  it("rejects an invalid cursor", async () => {
    const user = await createUser();
    const res = await request(app).get("/api/videos?before=not-a-date").set(auth(user));
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/videos/:id", () => {
  it("lets the owner delete their video and removes the file", async () => {
    const user = await createUser();
    const video = await uploadVideo(user);
    const res = await request(app).delete(`/api/videos/${video.id}`).set(auth(user));
    assert.equal(res.status, 200);
    assert.equal(blobStorage.deleteBlob.mock.callCount(), 1);

    const list = await request(app).get("/api/videos").set(auth(user));
    assert.equal(list.body.videos.length, 0);
  });

  it("stops other users deleting it", async () => {
    const owner = await createUser();
    const other = await createUser();
    const video = await uploadVideo(owner);
    const res = await request(app).delete(`/api/videos/${video.id}`).set(auth(other));
    assert.equal(res.status, 403);
  });

  it("returns 404 for an unknown id", async () => {
    const user = await createUser();
    const res = await request(app).delete("/api/videos/not-an-id").set(auth(user));
    assert.equal(res.status, 404);
  });
});
