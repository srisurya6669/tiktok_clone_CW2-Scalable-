import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import DeleteAccountModal from "./DeleteAccountModal";
import ProfilePage from "./ProfilePage";
import { mockFetch } from "../test/fetchMock";

function renderModal(props = {}) {
  return render(<DeleteAccountModal token="jwt" onClose={vi.fn()} onDeleted={vi.fn()} {...props} />);
}

describe("DeleteAccountModal", () => {
  it("warns what will be deleted and needs a password before it can be confirmed", () => {
    mockFetch([]);
    renderModal();
    expect(screen.getByRole("dialog")).toHaveTextContent(/every video you uploaded/);
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeDisabled();
  });

  it("sends the password and signs out when the account is deleted", async () => {
    const fetchMock = mockFetch([["DELETE", "/api/auth/me", () => ({ body: { message: "Account deleted" } })]]);
    const onDeleted = vi.fn();
    renderModal({ onDeleted });

    await userEvent.type(screen.getByPlaceholderText(/password/i), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(onDeleted).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ password: "secret-pass" });
    expect(options.headers.Authorization).toBe("Bearer jwt");
  });

  it("shows the error and keeps the user signed in when the password is wrong", async () => {
    mockFetch([["DELETE", "/api/auth/me", () => ({ status: 401, body: { message: "Incorrect password" } })]]);
    const onDeleted = vi.fn();
    renderModal({ onDeleted });

    await userEvent.type(screen.getByPlaceholderText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByText("Incorrect password")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeEnabled();
  });

  it("closes without deleting when cancelled", async () => {
    const fetchMock = mockFetch([]);
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ProfilePage delete account", () => {
  it("opens the confirmation dialog from the Delete account button", async () => {
    mockFetch([["GET", "/api/videos", () => ({ body: { videos: [], hasMore: false, total: 0 } })]]);
    const context = { user: { _id: "me", name: "Sam Lee", email: "sam@test.com" }, token: "jwt", onLogout: vi.fn() };
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route path="/" element={<ProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("dialog", { name: "Delete account" })).toBeInTheDocument();
  });
});
