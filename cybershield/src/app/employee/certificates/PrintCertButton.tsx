"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintCertButton({ verifyCode, courseTitle }: { verifyCode: string; courseTitle: string }) {
  function handlePrint() {
    const certEl = document.getElementById(`cert-${verifyCode}`);
    if (!certEl) return;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate — ${courseTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Georgia&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .cert-wrapper { width: 842px; height: 595px; }
          @media print { @page { size: A4 landscape; margin: 0; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="cert-wrapper">${certEl.outerHTML}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
      <Printer className="h-3.5 w-3.5" />
      Print / Save PDF
    </Button>
  );
}
