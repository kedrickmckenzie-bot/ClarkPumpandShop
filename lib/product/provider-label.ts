/**
 * One vocabulary for who does the work, used on every screen: the provider's
 * name (a person on the internal team or an outside vendor company) plus the
 * kind of provider. Labels follow the routing choices: Internal maintenance,
 * Outside vendor, Choose later.
 */
export type ProviderKind = "internal" | "outside_vendor" | "choose_later";

export const PROVIDER_KIND_LABEL: Record<ProviderKind, string> = {
  internal: "Internal",
  outside_vendor: "Outside vendor",
  choose_later: "Not chosen yet",
};

export function providerKindLabel(kind: ProviderKind | null | undefined): string {
  return PROVIDER_KIND_LABEL[kind ?? "choose_later"] ?? PROVIDER_KIND_LABEL.choose_later;
}

/** The name to show: the internal person, the vendor company, or "Choose later". */
export function providerName(input: { kind?: ProviderKind | null; vendorName?: string | null; internalName?: string | null }): string {
  if (input.kind === "internal") return input.internalName?.trim() || "Internal team";
  if (input.kind === "outside_vendor") return input.vendorName?.trim() || "Outside vendor";
  return "Choose later";
}

/** "Internal · Assigned" / "Outside vendor · Issued": the kind first, then any detail. */
export function providerDetail(kind: ProviderKind | null | undefined, detail?: string | null): string {
  return [providerKindLabel(kind), detail?.trim()].filter(Boolean).join(" · ");
}

/** Tag for table cells; only internal and outside-vendor work gets an icon. */
export function providerTag(kind: ProviderKind | null | undefined): "internal" | "outside_vendor" | undefined {
  return kind === "internal" || kind === "outside_vendor" ? kind : undefined;
}
