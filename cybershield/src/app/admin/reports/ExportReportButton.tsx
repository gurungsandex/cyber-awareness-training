"use client";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ReportData {
  generatedAt: string;
  totalEmployees: number;
  avgRisk: number;
  completionRate: number;
  passRate: number;
  overdueCount: number;
  computedRisk: number;
  phishClickRate: number;
}

export function ExportReportButton({ data }: { data: ReportData }) {
  function exportCSV() {
    const rows = [
      ["CyberShield Executive Summary Report"],
      [`Generated: ${new Date(data.generatedAt).toLocaleString("en-GB")}`],
      [],
      ["Metric", "Value"],
      ["Total Employees", data.totalEmployees],
      ["Avg Employee Risk Score", data.avgRisk],
      ["Org Computed Risk Score", data.computedRisk],
      ["Course Completion Rate (%)", data.completionRate],
      ["Assessment Pass Rate (%)", data.passRate],
      ["Overdue Courses", data.overdueCount],
      ["Phishing Click Rate (%)", data.phishClickRate],
    ];

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cybershield-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
      <FileDown className="h-4 w-4" />
      Export Report
    </Button>
  );
}
