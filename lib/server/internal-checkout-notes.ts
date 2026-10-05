import { formText } from "./ops-request-context";
import { OpsDomainError } from "@/lib/ops/errors";

/** The quick check is an attributed result assertion, not a separate store confirmation. */
export function internalCheckoutNotes(form: FormData, prefix = "") {
  const notes = formText(form, `${prefix}notes`, { max: 3000 }),
    check = formText(form, `${prefix}workingWhenLeft`, { max: 20 });
  if (check && !["yes", "no", "not_checked"].includes(check))
    throw new OpsDomainError("VALIDATION", "Choose a valid quick check.");
  return (
    [
      notes,
      check
        ? `Quick check — working when I left: ${{ yes: "Yes", no: "No", not_checked: "Not checked" }[check]}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n") || undefined
  );
}
