import { OpsDomainError } from "@/lib/ops/errors";
import { createReportSchedule } from "@/lib/ops/reports/schedules";
import { parseReportOptions } from "@/lib/ops/reports/options";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";
import { reportDefaults } from "@/lib/server/report-model";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

/** Saves a report schedule. Validation errors return to the form with a plain message. */
export async function POST(request: Request) {
  let back = "/app/reports/schedules/new";
  try {
    const { session, repository, actor } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"], undefined, request);
    const form = await request.formData();
    const reportId = formText(form, "report", { required: true, max: 80 });
    const entry = reportCatalogEntry(reportId);
    if (!entry) throw new OpsDomainError("VALIDATION", "Choose a report.");
    const options = parseReportOptions(key => { const v = form.get(key); return typeof v === "string" ? v : undefined; }, reportDefaults(entry));
    back = `/app/reports/schedules/new?report=${encodeURIComponent(reportId)}`;
    const number = (key: string) => { const v = formText(form, key, { max: 4 }); return v === "" ? undefined : Number(v); };
    await createReportSchedule({ repository }, {
      organizationId: session.organizationId, actor, reportId, options, role: session.role,
      frequency: formText(form, "frequency", { max: 10 }) as "weekly" | "monthly",
      weekday: number("weekday"), monthDay: number("monthDay"), sendHour: number("sendHour") ?? -1,
      recipients: form.getAll("recipient").filter((v): v is string => typeof v === "string").slice(0, 25),
    });
    return relativeRedirect303("/app/reports?saved=schedule-created#report-schedules");
  } catch (error) {
    if (error instanceof OpsDomainError && error.code === "VALIDATION") return relativeRedirect303(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
    return opsApiError(error);
  }
}
