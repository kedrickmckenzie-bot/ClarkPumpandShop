import { redirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

/** Older print links open the report page, which prints the same way. */
export default async function PrintReportRedirect({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<Query> }) {
  const [{ reportId }, query] = await Promise.all([params, searchParams]);
  const next = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => typeof v === "string" ? [[k, v]] : []));
  redirect(`/app/reports/${encodeURIComponent(reportId)}${next.size ? `?${next}` : ""}`);
}
