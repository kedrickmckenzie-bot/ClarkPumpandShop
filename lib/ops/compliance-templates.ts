/**
 * Ready-made c-store compliance schedules. Picking one fills in the new-schedule form; the person still picks
 * stores, who does it and the first due date, and can change anything before saving. Frequencies follow the
 * common federal or national rule; states, fire marshals and water authorities can be stricter.
 */
export interface ComplianceTemplate {
  key: string;
  group: ComplianceTemplateGroup;
  name: string;
  kind: "inspection" | "permit";
  intervalUnit: "months" | "days";
  intervalCount: number;
  leadDays: number;
  evidenceLabel: string;
  evidenceRequired: 0 | 1;
  instructions: string;
  requirementSource: string;
  /** Who usually does it. */
  who: "team" | "vendor";
}

export type ComplianceTemplateGroup = "ust" | "fire" | "kitchen" | "plumbing" | "fuel";
export const TEMPLATE_GROUPS: Record<ComplianceTemplateGroup, string> = {
  ust: "Fuel tanks (UST)",
  fire: "Fire and life safety",
  kitchen: "Kitchen",
  plumbing: "Plumbing",
  fuel: "Fuel dispensers",
};

const UST = "EPA UST rule (40 CFR 280). Your state may be stricter; check your state UST program.";

export const COMPLIANCE_TEMPLATES: readonly ComplianceTemplate[] = [
  { key: "ust-monthly-leak-detection", group: "ust", name: "Monthly tank leak detection result", kind: "inspection", intervalUnit: "months", intervalCount: 1, leadDays: 7, evidenceLabel: "Optional: photo or printout of the tank monitor report", evidenceRequired: 0, who: "team",
    instructions: "Look at the tank monitor: does every tank and line show a passing leak test this month? If yes, mark it passed. If anything failed or is missing, mark it failed: that opens a repair job, and call your tank contractor the same day. Keep the monitor's own reports; a photo here is optional.", requirementSource: UST },
  { key: "ust-30-day-walkthrough", group: "ust", name: "30-day tank walkthrough", kind: "inspection", intervalUnit: "months", intervalCount: 1, leadDays: 7, evidenceLabel: "Optional: photos of anything wrong", evidenceRequired: 0, who: "team",
    instructions: "Open each spill bucket: remove any fuel, water or debris and check for cracks. Check the tank monitor for alarms and that it is working. Mark it passed, or write down what you found.", requirementSource: UST },
  { key: "ust-annual-walkthrough", group: "ust", name: "Yearly tank walkthrough", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Walkthrough checklist", evidenceRequired: 1, who: "team",
    instructions: "Open the tank-top and under-dispenser sumps: check for damage, leaks, liquid or debris. Check any hand-held leak detection equipment, such as tank gauge sticks.", requirementSource: UST },
  { key: "ust-annual-equipment-test", group: "ust", name: "Yearly leak detection equipment test", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Tester's report", evidenceRequired: 1, who: "vendor",
    instructions: "A qualified tester checks the tank monitor, probes and sensors, and the automatic line leak detectors.", requirementSource: UST },
  { key: "ust-spill-test", group: "ust", name: "Spill bucket test", kind: "inspection", intervalUnit: "months", intervalCount: 36, leadDays: 60, evidenceLabel: "Tester's report", evidenceRequired: 1, who: "vendor",
    instructions: "Every 3 years, unless the spill buckets are double-walled and checked every 30 days.", requirementSource: UST },
  { key: "ust-overfill-inspection", group: "ust", name: "Overfill prevention inspection", kind: "inspection", intervalUnit: "months", intervalCount: 36, leadDays: 60, evidenceLabel: "Inspection report", evidenceRequired: 1, who: "vendor",
    instructions: "Every 3 years: check that the overfill device (flapper valve, alarm or ball float) shuts off or alarms at the right level.", requirementSource: UST },
  { key: "ust-sump-test", group: "ust", name: "Containment sump test", kind: "inspection", intervalUnit: "months", intervalCount: 36, leadDays: 60, evidenceLabel: "Tester's report", evidenceRequired: 1, who: "vendor",
    instructions: "Every 3 years for sumps used to monitor piping for leaks, unless they are double-walled and checked every 30 days.", requirementSource: UST },
  { key: "ust-cathodic-test", group: "ust", name: "Cathodic protection test", kind: "inspection", intervalUnit: "months", intervalCount: 36, leadDays: 60, evidenceLabel: "Corrosion tester's report", evidenceRequired: 1, who: "vendor",
    instructions: "Only for steel tanks or piping protected from rust (cathodic protection). Every 3 years, and within 6 months of any repair. Impressed-current systems also need the rectifier checked every 60 days.", requirementSource: UST },
  { key: "fire-extinguisher-monthly", group: "fire", name: "Fire extinguisher monthly check", kind: "inspection", intervalUnit: "months", intervalCount: 1, leadDays: 7, evidenceLabel: "Initials and date on each tag", evidenceRequired: 0, who: "team",
    instructions: "Each extinguisher is in place, easy to reach, the gauge is in the green, the pin and seal are intact and there is no damage. Initial and date the tag.", requirementSource: "NFPA 10; local fire code" },
  { key: "fire-extinguisher-annual", group: "fire", name: "Fire extinguisher yearly service", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Service tags or company report", evidenceRequired: 1, who: "vendor",
    instructions: "A licensed fire protection company services and tags every extinguisher.", requirementSource: "NFPA 10; local fire code" },
  { key: "emergency-lights-monthly", group: "fire", name: "Emergency lights and exit signs monthly test", kind: "inspection", intervalUnit: "months", intervalCount: 1, leadDays: 7, evidenceLabel: "Test log", evidenceRequired: 0, who: "team",
    instructions: "Press the test button on each emergency light and exit sign for at least 30 seconds. Every light should stay on. Write down any that don't.", requirementSource: "NFPA 101; local fire code" },
  { key: "emergency-lights-annual", group: "fire", name: "Emergency lights yearly 90-minute test", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Test log", evidenceRequired: 1, who: "team",
    instructions: "Run every emergency light on battery for 90 minutes. Replace batteries or units that don't last.", requirementSource: "NFPA 101; local fire code" },
  { key: "fire-alarm-annual", group: "fire", name: "Fire alarm inspection", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Inspection report", evidenceRequired: 1, who: "vendor",
    instructions: "A licensed company tests the fire alarm panel, pull stations, detectors and monitoring.", requirementSource: "NFPA 72; local fire code" },
  { key: "sprinkler-annual", group: "fire", name: "Sprinkler system inspection", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Inspection report", evidenceRequired: 1, who: "vendor",
    instructions: "A licensed company inspects and tests the sprinkler system. Some parts also need quarterly checks; follow the company's report.", requirementSource: "NFPA 25; local fire code" },
  { key: "hood-suppression", group: "kitchen", name: "Kitchen hood fire suppression inspection", kind: "inspection", intervalUnit: "months", intervalCount: 6, leadDays: 21, evidenceLabel: "Service tag or report", evidenceRequired: 1, who: "vendor",
    instructions: "A licensed company inspects the hood fire suppression system every 6 months.", requirementSource: "NFPA 17A and 96; local fire code" },
  { key: "hood-cleaning", group: "kitchen", name: "Kitchen exhaust hood cleaning", kind: "inspection", intervalUnit: "months", intervalCount: 6, leadDays: 21, evidenceLabel: "Cleaning certificate or photos", evidenceRequired: 1, who: "vendor",
    instructions: "Clean the hood, filters and ductwork. Every 6 months is typical for moderate cooking; heavy fryer use may need every 3 months.", requirementSource: "NFPA 96; local fire code" },
  { key: "grease-trap", group: "plumbing", name: "Grease trap pumping", kind: "inspection", intervalUnit: "months", intervalCount: 3, leadDays: 14, evidenceLabel: "Pump-out receipt or manifest", evidenceRequired: 1, who: "vendor",
    instructions: "Pump out the grease trap or interceptor. Many cities require it every 90 days or when it is a quarter full.", requirementSource: "Local sewer authority" },
  { key: "backflow-annual", group: "plumbing", name: "Backflow preventer test", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Test report filed with the water authority", evidenceRequired: 1, who: "vendor",
    instructions: "A certified tester tests each backflow preventer and sends the report to the water authority.", requirementSource: "Local water authority" },
  { key: "pump-accuracy", group: "fuel", name: "Fuel pump accuracy check", kind: "inspection", intervalUnit: "months", intervalCount: 12, leadDays: 30, evidenceLabel: "Calibration report or inspection sticker", evidenceRequired: 1, who: "vendor",
    instructions: "Check every dispenser meter delivers the right amount and the seals are intact. Your state's weights and measures office may test on its own schedule.", requirementSource: "State weights and measures" },
];

export function complianceTemplate(key: string | undefined) {
  return COMPLIANCE_TEMPLATES.find((template) => template.key === key);
}
