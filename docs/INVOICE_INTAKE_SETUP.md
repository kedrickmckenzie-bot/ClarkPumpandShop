# Invoice intake

Invoices → Upload invoices accepts up to ten PDFs or photos, one invoice per file, 15 MB each. Files are saved privately before reading. The upload request returns a persisted row, then the browser starts reading each saved upload. If the browser closes between those steps, Invoices and Overview retain an actionable queued upload with a retry control. This implementation has no unattended background extraction worker.

## Reader configuration

Set `OPENAI_API_KEY` and `INVOICE_EXTRACTION_MODEL` on the server. Use a Responses API model that supports PDF/image inputs and strict structured outputs. Never expose these settings to the browser. A configured reader sends the uploaded document to OpenAI with `store:false`; the source is retained in the application's private object store. Deploy the new database migrations before enabling uploads. Existing R2/D1 and S3/PostgreSQL adapters remain supported.

Without a reader, files remain available under Needs review for manual entry. Provider errors, timeouts, unsupported documents and uncertain readings never produce guessed invoices. Real provider extraction must be tested with representative authorized invoices before relying on its accuracy.

## Matching and review

Automatic recording requires one invoice, a valid date/number/currency, exact operator work-order reference, matching assigned vendor, a readable matching service location, no conflicting store fields, no uncertain fields, and line amounts equal to the stated total. Store name, number and address support matching checks and manual search; they do not substitute for an exact work-order reference. Vendor ticket and accounting PO numbers remain distinct.

Canonical invoice safeguards then flag duplicates, warranty holds, authorization differences and the work order's internal flag amount. Missing optional authorization/contract alone does not block automatic intake. Amount flags record review facts, not deductions or payment approval. Manual corrections preserve the original extraction and source document in audit history. Review includes an explicit original-document confirmation and reason.

Identical files are deduplicated within the organization. Version fences prevent repeated recording; the vendor/invoice-number fence prevents competing intake requests from creating duplicate invoices. Files, invoices, allocations, review flags and audit remain organization-scoped. Uploads currently require companywide invoice write access; scoped operators cannot open unallocated files.

Local fixture files reset on process restart. Hosted files use the configured private R2/S3 store; no production uploads are written to local disk.

API reference: https://developers.openai.com/api/docs/guides/file-inputs and https://developers.openai.com/api/docs/guides/structured-outputs.
