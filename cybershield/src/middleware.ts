import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Build a per-request Content-Security-Policy. Scripts are locked to a per-request
 * nonce plus 'strict-dynamic' (so Next.js's own bootstrap scripts, which carry the
 * nonce, load and can pull in the chunks they need). Inline styles are allowed via
 * 'unsafe-inline' because the UI uses React `style` props and style attributes,
 * which nonces cannot cover.
 */
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // ── Content-Security-Policy ──
  // Ships in Report-Only mode by default: the browser reports violations but
  // enforces nothing, so a mis-scoped directive can never take the app down.
  // Once validated against real traffic, set CSP_MODE=enforce to switch the
  // header to the enforcing variant. The nonce is injected into Next's scripts
  // in both modes (via the request header below), so flipping to enforce is safe.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);
  const enforce = process.env.CSP_MODE === "enforce";
  const cspHeaderName = enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  const withCsp = <T extends NextResponse>(res: T): T => {
    res.headers.set(cspHeaderName, csp);
    return res;
  };

  const isLogin = nextUrl.pathname === "/login";
  const isPublic = isLogin
    || nextUrl.pathname.startsWith("/register")
    || nextUrl.pathname.startsWith("/api/register")
    || nextUrl.pathname.startsWith("/api/auth")
    || nextUrl.pathname === "/api/health"
    || nextUrl.pathname.startsWith("/_next")
    || nextUrl.pathname === "/";

  if (!session && !isPublic) {
    // API routes must answer with a JSON 401, not a 302 to the HTML login page —
    // a redirect makes client-side fetch().json() calls fail on unparseable HTML.
    if (nextUrl.pathname.startsWith("/api")) {
      return withCsp(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const url = new URL("/login", nextUrl);
    url.searchParams.set("from", nextUrl.pathname);
    return withCsp(NextResponse.redirect(url));
  }

  if (session && isLogin) {
    const role = (session.user as any).role as string;
    const home = role === "ADMIN" ? "/admin" : role === "MANAGER" ? "/manager" : "/employee";
    return withCsp(NextResponse.redirect(new URL(home, nextUrl)));
  }

  if (session) {
    const role = (session.user as any).role as string;
    if (nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") return withCsp(NextResponse.redirect(new URL("/", nextUrl)));
    if (nextUrl.pathname.startsWith("/manager") && !["ADMIN", "MANAGER"].includes(role)) return withCsp(NextResponse.redirect(new URL("/", nextUrl)));
  }

  // Forward the nonce to the render so Next.js stamps it onto its scripts. The
  // enforcing header name on the *request* is Next's signal to do the injection;
  // it is never sent to the browser, so this does not enforce anything on its own.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
