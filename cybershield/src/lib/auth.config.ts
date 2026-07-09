import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config (no bcrypt, no ioredis, no Prisma) — imported by
// src/middleware.ts, which runs on the Edge runtime and crashes if anything
// in its import graph touches Node-only APIs (sockets, etc). The Credentials
// provider's authorize() callback needs bcrypt + Redis, so it lives only in
// the full config in auth.ts, which is never imported by middleware.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
};
