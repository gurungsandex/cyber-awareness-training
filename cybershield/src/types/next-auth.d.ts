import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "ADMIN" | "MANAGER" | "EMPLOYEE";
      tenantId: string | null;
    };
  }
  interface User {
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    tenantId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    tenantId: string | null;
  }
}
