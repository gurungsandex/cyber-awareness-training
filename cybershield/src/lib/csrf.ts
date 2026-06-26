const UNSAFE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export function isTrustedOrigin(req: { method: string; nextUrl: URL; headers: Headers }) {
  if (!UNSAFE_METHODS.includes(req.method)) return true;
  if (!req.nextUrl.pathname.startsWith("/api/")) return true;
  const origin = req.headers.get("origin");
  // No Origin header (e.g. same-origin requests in some older browsers, or non-browser
  // clients using bearer auth) — allow through; cookie-based requests always send Origin.
  if (!origin) return true;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}
