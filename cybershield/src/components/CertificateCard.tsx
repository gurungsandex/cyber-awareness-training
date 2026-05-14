"use client";
import { Shield, Award } from "lucide-react";

interface Props {
  recipientName: string;
  courseTitle: string;
  issuedAt: Date | string;
  verifyCode: string;
  onPrint?: () => void;
}

export function CertificateCard({ recipientName, courseTitle, issuedAt, verifyCode }: Props) {
  const date = new Date(issuedAt);
  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      id={`cert-${verifyCode}`}
      className="relative w-full max-w-2xl mx-auto bg-white rounded-2xl overflow-hidden shadow-xl print:shadow-none"
      style={{ fontFamily: "serif", aspectRatio: "1.414/1" }}
    >
      {/* Outer border */}
      <div className="absolute inset-0 border-8 border-[#1a3a2e] rounded-2xl" />
      {/* Inner border */}
      <div className="absolute inset-3 border-2 border-[#c9a84c] rounded-xl" />

      {/* Corner ornaments */}
      {["top-5 left-5", "top-5 right-5", "bottom-5 left-5", "bottom-5 right-5"].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-8 h-8 flex items-center justify-center`}>
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#c9a84c] fill-current opacity-70">
            <path d="M12 2L14.09 8.26L21 9L15.5 14L17.18 21L12 18L6.82 21L8.5 14L3 9L9.91 8.26L12 2Z" />
          </svg>
        </div>
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-12 py-8 text-center">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-[#1a3a2e]">
            <Shield className="h-5 w-5 text-[#c9a84c]" />
          </div>
          <span className="text-[#1a3a2e] text-sm font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "sans-serif" }}>
            CyberShield
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-[#1a3a2e] text-2xl font-bold tracking-widest uppercase mb-1"
          style={{ letterSpacing: "0.25em" }}
        >
          Certificate
        </h1>
        <p className="text-[#8b6914] text-xs tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "sans-serif" }}>
          of Completion
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full mb-5">
          <div className="flex-1 h-px bg-[#c9a84c] opacity-40" />
          <Award className="h-4 w-4 text-[#c9a84c]" />
          <div className="flex-1 h-px bg-[#c9a84c] opacity-40" />
        </div>

        {/* Awarded to */}
        <p className="text-[#555] text-xs tracking-widest uppercase mb-1" style={{ fontFamily: "sans-serif" }}>
          This is to certify that
        </p>
        <h2
          className="text-[#1a3a2e] text-3xl font-bold mb-2"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {recipientName}
        </h2>
        <p className="text-[#555] text-xs mb-3" style={{ fontFamily: "sans-serif" }}>
          has successfully completed
        </p>
        <p
          className="text-[#1a3a2e] text-base font-semibold italic mb-4 px-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          &ldquo;{courseTitle}&rdquo;
        </p>
        <p className="text-[#555] text-xs mb-5" style={{ fontFamily: "sans-serif" }}>
          and demonstrated the required knowledge in cybersecurity awareness training.
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full mb-5">
          <div className="flex-1 h-px bg-[#c9a84c] opacity-40" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] opacity-60" />
          <div className="flex-1 h-px bg-[#c9a84c] opacity-40" />
        </div>

        {/* Footer row */}
        <div className="flex items-end justify-between w-full text-xs" style={{ fontFamily: "sans-serif" }}>
          <div className="text-left">
            <p className="text-[#555] mb-0.5">Date of Issue</p>
            <p className="font-semibold text-[#1a3a2e]">{formattedDate}</p>
          </div>

          {/* Seal */}
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-full border-4 border-[#1a3a2e] flex items-center justify-center bg-white shadow-inner">
              <div className="w-10 h-10 rounded-full bg-[#1a3a2e] flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#c9a84c]" />
              </div>
            </div>
            <p className="text-[8px] text-[#888] mt-1 tracking-widest uppercase">Official Seal</p>
          </div>

          <div className="text-right">
            <p className="text-[#555] mb-0.5">Verification Code</p>
            <p className="font-mono font-bold text-[#1a3a2e] text-xs">{verifyCode}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
