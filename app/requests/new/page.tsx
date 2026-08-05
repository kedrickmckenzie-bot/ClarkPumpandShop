import type { Metadata } from "next";
import { EmployeeReportForm } from "@/components/employee-report-form";

export const metadata: Metadata = { title: "Report Store Issue" };

export default function Page() {
  return <EmployeeReportForm />;
}
