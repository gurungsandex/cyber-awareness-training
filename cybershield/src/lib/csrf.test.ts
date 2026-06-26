import { describe, it, expect } from "vitest";
import { isTrustedOrigin } from "./csrf";

function req(method: string, path: string, originHeader: string | null) {
  return {
    method,
    nextUrl: new URL(`https://app.example.com${path}`),
    headers: new Headers(originHeader ? { origin: originHeader } : {}),
  };
}

describe("isTrustedOrigin", () => {
  it("allows safe methods regardless of origin", () => {
    expect(isTrustedOrigin(req("GET", "/api/admin/users", "https://evil.com"))).toBe(true);
  });

  it("allows unsafe methods on non-API routes", () => {
    expect(isTrustedOrigin(req("POST", "/login", "https://evil.com"))).toBe(true);
  });

  it("allows a matching-origin POST to an API route", () => {
    expect(isTrustedOrigin(req("POST", "/api/admin/users", "https://app.example.com"))).toBe(true);
  });

  it("rejects a cross-origin POST to an API route", () => {
    expect(isTrustedOrigin(req("POST", "/api/admin/users", "https://evil.com"))).toBe(false);
  });

  it("rejects a cross-origin DELETE", () => {
    expect(isTrustedOrigin(req("DELETE", "/api/admin/departments/1", "https://evil.com"))).toBe(false);
  });

  it("allows requests with no Origin header (server-to-server / older clients)", () => {
    expect(isTrustedOrigin(req("POST", "/api/admin/users", null))).toBe(true);
  });

  it("rejects a malformed Origin header on an unsafe API request", () => {
    expect(isTrustedOrigin(req("POST", "/api/admin/users", "not-a-url"))).toBe(false);
  });
});
