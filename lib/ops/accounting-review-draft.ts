import type { AccountingReviewModel, AccountingWorkChoice } from "./accounting-review-model";
export interface AccountingReviewDraft {
  version: number; vendorId: string; existingInvoiceId: string; reason: string; distinct: boolean;
  splits: Array<{ lineId: string; workOrderId: string; amount: string }>;
  choices: AccountingWorkChoice[];
}
export function createAccountingDraft(model: AccountingReviewModel): AccountingReviewDraft {
  return { version: model.version, vendorId: model.delivery.vendorId ?? "", existingInvoiceId: model.linkedInvoiceId ?? "", reason: model.reviewNote, distinct: false, choices: model.work,
    splits: model.delivery.lines.flatMap((line) => { const saved = model.splits.filter((split) => split.lineId === line.id); return saved.length ? saved.map((split) => ({ ...split, amount: (split.amountMinor / 100).toFixed(2) })) : [{ lineId: line.id, workOrderId: "", amount: (line.amountMinor / 100).toFixed(2) }]; }) };
}
/** Search changes choices only. Selected records remain available across queries. */
export function retainAccountingChoices(draft: AccountingReviewDraft, choices: AccountingWorkChoice[]): AccountingReviewDraft {
  const selected = new Set(draft.splits.map((split) => split.workOrderId));
  return { ...draft, choices: [...new Map([...draft.choices.filter((choice) => selected.has(choice.id)), ...choices].map((choice) => [choice.id, choice])).values()] };
}
export function accountingDraftAmounts(model: AccountingReviewModel, draft: AccountingReviewDraft) {
  return model.delivery.lines.map((line) => {
    const splits = draft.splits.filter((split) => split.lineId === line.id);
    const valid = splits.every((split) => /^\d+(?:\.\d{1,2})?$/.test(split.amount) && Boolean(split.workOrderId));
    const allocated = splits.reduce((sum, split) => sum + (/^\d+(?:\.\d{1,2})?$/.test(split.amount) ? Math.round(Number(split.amount) * 100) : 0), 0);
    return { id: line.id, total: line.amountMinor, allocated, remaining: line.amountMinor - allocated, valid: valid && allocated === line.amountMinor };
  });
}
/** Explicit recovery adopts the latest source version, retaining compatible
 * user entries for review. Removed items cannot be submitted against it. */
export function recoverAccountingDraft(draft: AccountingReviewDraft, latest: AccountingReviewModel): AccountingReviewDraft {
  const defaults = createAccountingDraft(latest);
  return retainAccountingChoices({ ...draft, version: latest.version, splits: latest.delivery.lines.flatMap((line) => { const retained = draft.splits.filter((split) => split.lineId === line.id); return retained.length ? retained : defaults.splits.filter((split) => split.lineId === line.id); }) }, latest.work);
}
