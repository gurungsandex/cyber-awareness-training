import "./globals.css";
import { Sora, DM_Sans } from "next/font/google";
import type { Metadata } from "next";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CyberShield — Security Awareness Platform",
  description: "Enterprise phishing simulation and security training",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${sora.variable} ${dmSans.variable}`}>
      <body className="h-full antialiased bg-canvas text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
