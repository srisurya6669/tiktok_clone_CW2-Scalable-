import { vi } from "vitest";

// Builds a fake fetch from a list of [method, urlPart, responder] routes.
// A responder returns { status, body } or throws to simulate a network failure.
export function mockFetch(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    const route = routes.find(
      ([routeMethod, urlPart]) => routeMethod === method && String(url).includes(urlPart)
    );
    if (!route) throw new Error(`Unexpected request: ${method} ${url}`);

    const { status = 200, body = {} } = await route[2](url, options);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
