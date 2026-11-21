import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "./LoginForm";
import { mockFetch } from "../test/fetchMock";

async function fillAndSubmit(email = "alice@test.com", password = "password123") {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Email"), email);
  await user.type(screen.getByPlaceholderText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  it("logs in and passes the token and profile to the app", async () => {
    const profile = { _id: "u1", name: "Alice", email: "alice@test.com" };
    const fetchMock = mockFetch([
      ["POST", "/api/auth/login", () => ({ body: { token: "jwt-123" } })],
      ["GET", "/api/auth/me", () => ({ body: { user: profile } })],
    ]);
    const onLoginSuccess = vi.fn();
    render(<LoginForm onLoginSuccess={onLoginSuccess} />);

    await fillAndSubmit();

    expect(onLoginSuccess).toHaveBeenCalledWith({ token: "jwt-123", user: profile });
    const [, loginOptions] = fetchMock.mock.calls[0];
    expect(JSON.parse(loginOptions.body)).toEqual({
      email: "alice@test.com",
      password: "password123",
    });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer jwt-123");
  });

  it("shows the server's error for wrong credentials", async () => {
    mockFetch([
      ["POST", "/api/auth/login", () => ({ status: 401, body: { message: "Invalid email or password" } })],
    ]);
    const onLoginSuccess = vi.fn();
    render(<LoginForm onLoginSuccess={onLoginSuccess} />);

    await fillAndSubmit("alice@test.com", "wrong-pass");

    expect(await screen.findByRole("status")).toHaveTextContent("Invalid email or password");
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it("explains when the server cannot be reached", async () => {
    mockFetch([
      ["POST", "/api/auth/login", () => { throw new TypeError("Failed to fetch"); }],
    ]);
    render(<LoginForm onLoginSuccess={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent("Cannot connect to the server");
  });

  it("shows and hides the password", async () => {
    render(<LoginForm onLoginSuccess={vi.fn()} />);
    const password = screen.getByPlaceholderText("Password");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
