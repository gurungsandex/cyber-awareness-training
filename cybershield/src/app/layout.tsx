import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CyberShield — Security Awareness Platform",
  description: "Enterprise phishing simulation and security training",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
