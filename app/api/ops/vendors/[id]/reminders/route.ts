import { completeVendorReminder, createVendorReminder, OpsDomainError, updateVendorReminder } from "@/lib/ops/commands";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const { id: vendorId } = await params;
    const organizationId = context.session.organizationId;
    const [vendor, organization] = await Promise.all([
      context.repository.getVendor(organizationId, vendorId),
      context.repository.getOrganization(organizationId),
    ]);
    if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    const reminderId = formText(formData, "reminderId", { max: 120 });

    if (operation === "complete") {
      if (!reminderId) throw new OpsDomainError("VALIDATION", "Choose a vendor reminder to complete.");
      const reminder = await context.repository.getVendorReminder(organizationId, reminderId);
      if (!reminder || reminder.vendorId !== vendorId) throw new OpsDomainError("NOT_FOUND", "Vendor reminder was not found on this vendor.");
      await completeVendorReminder({ repository: context.repository }, {
        organizationId,
        reminderId,
        completionNote: formText(formData, "completionNote", { required: true, max: 2_000 }),
        actor: context.actor,
      });
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Reminder+completed#vendor-reminders`);
    }

    const dueAt = localDateTimeToIso(
      formText(formData, "dueAt", { required: true, max: 40 }),
      organization?.timeZone ?? "UTC",
    );
    const shared = {
      organizationId,
      title: formText(formData, "title", { required: true, max: 240 }),
      note: formText(formData, "note", { max: 2_000 }) || undefined,
      accountableParty: formText(formData, "accountableParty", { required: true, max: 200 }),
      dueAt,
      escalationTo: formText(formData, "escalationTo", { required: true, max: 200 }),
      actor: context.actor,
    };
    if (operation === "create") {
      await createVendorReminder({ repository: context.repository }, { ...shared, vendorId });
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Vendor+reminder+added#vendor-reminders`);
    }
    if (operation === "update") {
      if (!reminderId) throw new OpsDomainError("VALIDATION", "Choose a vendor reminder to update.");
      const reminder = await context.repository.getVendorReminder(organizationId, reminderId);
      if (!reminder || reminder.vendorId !== vendorId) throw new OpsDomainError("NOT_FOUND", "Vendor reminder was not found on this vendor.");
      await updateVendorReminder({ repository: context.repository }, {
        ...shared,
        reminderId,
        updateNote: formText(formData, "updateNote", { required: true, max: 2_000 }),
      });
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Reminder+updated#vendor-reminders`);
    }
    throw new OpsDomainError("VALIDATION", "Choose a supported vendor reminder action.");
  } catch (error) {
    return opsApiError(error);
  }
}
