import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcryptjs";
import { redis } from "./redis";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

async function isLoginRateLimited(email: string): Promise<boolean> {
  try {
    const key = `login_attempts:${email.toLowerCase()}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, LOGIN_WINDOW_SECONDS);
    return attempts > LOGIN_MAX_ATTEMPTS;
  } catch {
    // Redis unavailable: fail open rather than locking out all logins.
    return false;
  }
}

async function clearLoginAttempts(email: string) {
  try {
    await redis.del(`login_attempts:${email.toLowerCase()}`);
  } catch {
    // non-fatal
  }
}

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

        if (await isLoginRateLimited(email)) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;
        await clearLoginAttempts(email);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
});
