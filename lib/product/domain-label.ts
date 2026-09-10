const acronyms: Readonly<Record<string, string>> = {
  ap: "AP",
  api: "API",
  capex: "CapEx",
  csv: "CSV",
  gps: "GPS",
  hvac: "HVAC",
  id: "ID",
  nte: "NTE",
  pm: "PM",
  po: "PO",
  qr: "QR",
  rfp: "RFP",
  sms: "SMS",
  wo: "WO",
};

const operatorLabels: Readonly<Record<string, string>> = {
  realized_verified: "Confirmed financial benefits",
  identified_exposure: "Possible recoveries and risks",
  estimated_opportunity: "Estimated opportunities",
  invoice_deduction_requested: "Deduction requested — awaiting confirmation",
  awaiting_approval: "Waiting for approval",
  awaiting_vendor: "Waiting for vendor response",
  partially_paid: "Partly paid",
  approved_for_payment: "Approved for payment — payment not confirmed",
  in_progress: "In progress",
  needs_review: "Needs review",
  none_reported: "None reported",
  manual: "Linked by a reviewer",
  exact_work_order: "Matched by work-order number",
  not_required: "Not required",
};

/** Turns stable machine values into consistent operator language. */
export function domainLabel(value: string | undefined, fallback = "Not set") {
  if (!value?.trim()) return fallback;
  if (operatorLabels[value.trim()]) return operatorLabels[value.trim()];
  return value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(/\s+/)
    .map((word) => acronyms[word.toLocaleLowerCase("en-US")] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
