import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createResendEmailProvider, sendVendorServiceAuthorizationEmail } from "@/lib/ops/email-delivery";
import { importTemplate, parseCsv, previewImport } from "@/lib/ops/import-preview";

describe("transactional email and onboarding previews", () => {
  it("sends a vendor authorization through Resend with an idempotency key", async () => {
    let captured: RequestInit | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { captured = init; return new Response(JSON.stringify({ id: "email-123" }), { status: 200 }); });
    const fixture = buildNorthlinePresentationFixture();
    const workOrder = fixture.workOrders[0]!;
    const result = await sendVendorServiceAuthorizationEmail({ provider: createResendEmailProvider({ apiKey: "secret", from: "Operations <ops@example.com>", fetcher: fetcher as typeof fetch }), vendorEmail: "dispatch@example.com", vendorName: "Example Vendor", organizationName: "Northline Fuel & Market", workOrder, storeLabel: "Store 101 · Northline", actionUrl: "https://example.com/public/service/token", issuanceId: "issuance-1" });
    expect(result.messageId).toBe("email-123");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(captured?.headers).toMatchObject({ "Idempotency-Key": "service-authorization/issuance-1/dispatch@example.com" });
    expect(String(captured?.body)).toContain(workOrder.number);
  });

  it("parses quoted CSV cells and produces a non-writing store dry run", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(parseCsv('a,b\r\n"one, two","say ""yes"""\r\n')).toEqual([["a", "b"], ["one, two", 'say "yes"']]);
    const preview = previewImport("stores", `${importTemplate("stores")}999,Test Store,1 Main St,,Toledo,OH,43604,central,"test;new"\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(preview.writesPerformed).toBe(false);
    expect(preview.summary.error).toBe(0);
    expect(preview.rows[0]?.status).toBe("ready");
  });

  it("blocks duplicates and unknown equipment templates before apply", () => {
    const fixture = buildNorthlinePresentationFixture();
    const existing = fixture.stores.find((store) => store.organizationId === NORTHLINE_ORGANIZATION_ID)!;
    const duplicate = previewImport("stores", `${importTemplate("stores")}${existing.storeNumber},Duplicate,2 Main St,,Toledo,OH,43604,central,\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(duplicate.rows[0]?.errors).toContain("Store number already exists.");
    const equipment = previewImport("equipment", `${importTemplate("equipment")}999,Unknown machine,2,Machine,Rear room\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(equipment.summary.error).toBe(1);
  });
});
