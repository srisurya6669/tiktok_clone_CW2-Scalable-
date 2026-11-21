const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { app, startDatabase, stopDatabase, clearDatabase } = require("./helpers");

before(startDatabase);
afterEach(clearDatabase);
after(stopDatabase);

const validUser = { name: "Alice Smith", email: "alice@test.com", password: "password123" };
const register = (body = validUser) => request(app).post("/api/auth/register").send(body);

describe("POST /api/auth/register", () => {
  it("creates an account and returns a token", async () => {
    const res = await register();
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, "string");
  });

  it("rejects a duplicate email", async () => {
    await register();
    assert.equal((await register()).status, 409);
  });

  it("treats emails case-insensitively", async () => {
    await register();
    assert.equal((await register({ ...validUser, email: "ALICE@test.com" })).status, 409);
  });

  it("rejects a password shorter than 8 characters", async () => {
    assert.equal((await register({ ...validUser, password: "short" })).status, 400);
  });

  it("rejects missing fields", async () => {
    assert.equal((await register({ email: "x@test.com" })).status, 400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => register());
  const login = (body) => request(app).post("/api/auth/login").send(body);

  it("returns a token for correct credentials", async () => {
    const res = await login({ email: validUser.email, password: validUser.password });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
  });

  it("rejects a wrong password", async () => {
    const res = await login({ email: validUser.email, password: "wrong-password" });
    assert.equal(res.status, 401);
  });

  it("rejects an unknown email", async () => {
    const res = await login({ email: "nobody@test.com", password: "password123" });
    assert.equal(res.status, 401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the signed-in user without the password", async () => {
    const { body } = await register();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, validUser.name);
    assert.equal(res.body.user.email, validUser.email);
    assert.equal(res.body.user.password, undefined);
  });

  it("requires a token", async () => {
    assert.equal((await request(app).get("/api/auth/me")).status, 401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-token");
    assert.equal(res.status, 401);
  });
});

describe("GET /health", () => {
  it("reports ok when the database is connected", async () => {
    const res = await request(app).get("/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });
});
