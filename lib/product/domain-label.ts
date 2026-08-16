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

/** Turns stable machine values into consistent operator language. */
export function domainLabel(value: string | undefined, fallback = "Not set") {
  if (!value?.trim()) return fallback;
  return value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(/\s+/)
    .map((word) => acronyms[word.toLocaleLowerCase("en-US")] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
