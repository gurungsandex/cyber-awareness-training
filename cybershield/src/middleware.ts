import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLogin = nextUrl.pathname === "/login";
  const isPublic = isLogin
    || nextUrl.pathname.startsWith("/register")
    || nextUrl.pathname.startsWith("/api/register")
    || nextUrl.pathname.startsWith("/api/auth")
    || nextUrl.pathname.startsWith("/_next")
    || nextUrl.pathname === "/";

  if (!session && !isPublic) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const role = (session.user as any).role as string;
    const home = role === "ADMIN" ? "/admin" : role === "MANAGER" ? "/manager" : "/employee";
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  if (session) {
    const role = (session.user as any).role as string;
    if (nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") return NextResponse.redirect(new URL("/", nextUrl));
    if (nextUrl.pathname.startsWith("/manager") && !["ADMIN", "MANAGER"].includes(role)) return NextResponse.redirect(new URL("/", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|certificates).*)"],
};
