import type { Metadata } from "next";
import { ReportingSuite } from "@/components/reporting-platform";

export const metadata: Metadata = { title: "Build Report" };

export default function Page() {
  return <ReportingSuite initialReport="builder" />;
}
