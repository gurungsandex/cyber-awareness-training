import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-canvas to-canvas pointer-events-none" />
      <div className="relative z-10 w-full flex justify-center">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
