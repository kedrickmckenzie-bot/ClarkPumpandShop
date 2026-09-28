// Keep saved review history intact while giving older flags readable labels.
const legacyMessages: Record<string, string> = {
  "No immutable Authorization is linked to this Work Order. Review authority before payment approval.": "No approved spending amount is saved on this work order.",
  "Invoice total exceeds the latest immutable Authorization. Review scope and any Change Order; no deduction has been made.": "Invoice total is above the approved spending amount. Check whether the extra work was approved.",
  "Invoice and authorization currencies differ. Review the amounts.": "The invoice and approved spending amount use different currencies.",
  "Selected Vendor does not match the active Work Order assignment. Confirm the relationship before approval.": "The invoice vendor differs from the vendor assigned to this work order. Check who did the work.",
  "Invoice currency differs from the internal flag currency. Review the amount.": "The invoice and internal flag amount use different currencies.",
  "Invoice total is above the internal flag amount. Review the cost; vendor authorization is unchanged.": "Invoice total is above the internal flag amount. Check the cost.",
  "No matching trip rate was found in the selected Contract Version. Flag for human review of Vendor policy; no deduction has been made.": "No travel rate is listed in the vendor agreement. Check the travel charge.",
  "Trip line is above the matching Contract rate. Flag for human review; the billed amount remains unchanged.": "The travel charge is above the rate in the vendor agreement.",
  "An open Warranty Case requires diagnosis and responsibility review before financial approval.": "A warranty claim is still open. Check who is responsible for this cost.",
  "Another invoice is already allocated to this exact work order. Confirm this invoice covers separate work, a separate visit, or a valid remaining balance; no deduction has been made.": "This work order already has an invoice. Check whether this bill covers additional work or a remaining balance."
};
export function invoiceReviewMessage(message: string): string {
  return legacyMessages[message] ?? message;
}
