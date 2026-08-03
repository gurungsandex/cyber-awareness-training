import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcryptjs";

// A fixed, valid bcrypt digest compared against when no account matches, so the
// failure path takes the same time as a real wrong-password check. It is not a
// secret and matches no real password.
const DUMMY_HASH = "$2a$12$d1rUu.E4ph3vuCSj3tzm5O5RKZVcDXp2.7gJhqViQy8LEtBGSyoeK";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;

        // Loaded dynamically so ioredis never lands in the Edge middleware
        // bundle (this file is imported by middleware). Throttle repeated
        // failures per email; fails open if Redis is down.
        const { isLoginRateLimited, recordLoginFailure, clearLoginFailures } = await import("./rate-limit");
        if (await isLoginRateLimited(email)) return null;

        const user = await db.user.findUnique({ where: { email } });
        // Always run a bcrypt comparison, even when the user doesn't exist, so a
        // missing account and a wrong password take the same amount of time.
        // Otherwise the fast "no such user" path is a user-enumeration oracle.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(credentials.password as string, hash);
        // Deleted (soft-deleted) accounts must not be able to authenticate.
        if (!user || !valid || user.deletedAt) {
          await recordLoginFailure(email);
          return null;
        }
        await clearLoginFailures(email);
        return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
      },
    }),
  ],
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
        session.user.tenantId = (token.tenantId as string | null) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
});
