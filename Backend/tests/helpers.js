// Shared test setup: an in-memory MongoDB, fake Azure services and helpers to create users.
process.env.JWT_SECRET = "test-secret";

const path = require("path");
const { mock } = require("node:test");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Fake Azure Blob Storage: ownership checks use the real rules, network calls are mocks.
const blobStorage = {
  newBlobName: (userId, extension) => `${userId}/test-${Date.now()}${extension}`,
  isOwnBlob: (blobName, userId) =>
    typeof blobName === "string" && blobName.startsWith(`${userId}/`) && !blobName.includes(".."),
  uploadUrl: mock.fn(async (blobName) => `https://storage.test/videos/${blobName}?sig=upload`),
  readUrl: mock.fn(async (blobName) => `https://storage.test/videos/${blobName}?sig=read`),
  getProperties: mock.fn(async () => ({ contentLength: 1024, contentType: "video/mp4" })),
  deleteBlob: mock.fn(async () => ({ succeeded: true })),
};

// Fake Azure AI Language: returns no sentiment unless a test says otherwise.
const sentiment = {
  isConfigured: true,
  analyze: mock.fn(async () => null),
};

// Put the fakes in Node's module cache so the app loads them instead of the real services.
function useFake(relativePath, exports) {
  const file = require.resolve(path.join(__dirname, "..", relativePath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
useFake("Services/blobStorage", blobStorage);
useFake("Services/sentiment", sentiment);

const app = require("../app");

let mongo;

async function startDatabase() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

async function stopDatabase() {
  await mongoose.disconnect();
  await mongo.stop();
}

async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  for (const fake of [...Object.values(blobStorage), ...Object.values(sentiment)]) {
    if (fake?.mock) {
      fake.mock.resetCalls();
      fake.mock.restore();
    }
  }
}

let userCount = 0;

// Registers a new user and returns { token, id, email }.
async function createUser(name = "Test User") {
  userCount += 1;
  const email = `user${userCount}@test.com`;
  const register = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password: "password123" });
  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${register.body.token}`);
  return { token: register.body.token, id: me.body.user._id, email };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

module.exports = {
  app,
  blobStorage,
  sentiment,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  auth,
};
