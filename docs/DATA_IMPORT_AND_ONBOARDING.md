# Data Import and Onboarding

**Status:** target production-hardening model; no structured import pipeline is implemented

Imports must not block the initial reactive pilot. Lifecycle, warranty, contract, and trend insight will require controlled historical onboarding when a customer has trustworthy source data.

## Supported target domains

Introduce import templates in dependency order:

1. Organization hierarchy, Stores, addresses/aliases, and operating context.
2. Users, memberships, roles, and scope grants.
3. Vendors, contacts, specialties, coverage, qualifications, and compliance.
4. Equipment taxonomy, Assets, Components, and replacement profiles.
5. PM Programs, Plans, and historical occurrences.
6. Historical Work Orders, visits/outcomes, Repair Items, and costs.
7. Contracts/rate cards, warranty records, Quotes/Authorizations, invoices/lines/credits.

Import only into domain models that already have server-enforced invariants. Do not invent placeholder records to satisfy missing relationships.

## Batch workflow

```text
upload/register source
  -> parse into staging rows
  -> normalize and validate
  -> tenant-safe identity matching and duplicate detection
  -> preview counts, changes, errors, and confidence
  -> authorized commit under an idempotency key
  -> post-commit invariant/reconciliation checks
  -> review queue for unresolved rows
```

`ImportBatch` records organization, source system/file/checksum, schema/template version, actor, timestamps, status, totals, and commit/reversal result. `ImportRow` or equivalent records source row identity, normalized payload, match decisions, validation codes, target record IDs, confidence, and errors. Raw data and error exports follow retention and access policy.

## Safety and correctness

- Apply organization before parsing relationship IDs or searching matches.
- Reject cross-tenant and invalid cross-Store Asset/Component links.
- Use source-system plus source-record identifiers and batch idempotency to prevent retry duplicates.
- Validate reference dependencies and currency/date/timezone formats before commit.
- Preview creates no domain records.
- Commit uses bounded transactions/chunks with a resumable checkpoint; accepted rows are never silently re-applied.
- Immutable historical facts import with provenance and cannot overwrite native records silently.
- “Rollback” means reject the pre-commit batch or append attributed reversals/deactivations for a committed batch. Never erase audit/history to simulate rollback.
- Uploaded files use the private file boundary, type/size validation, and future malware scan.
- Importer permissions are separate from ordinary record-edit permissions.

## Matching and confidence

Use stable external IDs first, then controlled exact identifiers such as store number within organization, vendor plus invoice number, Asset tag/serial, and operator Work Order number. Fuzzy suggestions require human confirmation.

Label each resulting relationship:

- Verified structured
- High-confidence matched
- Medium-confidence matched
- Low-confidence suggestion
- Unallocated
- Requires review

Preserve source, rule/version, reviewer, and decision. Low-quality imported data cannot support high-confidence KPI, warranty, or lifecycle claims.

## Onboarding sequence

Start with organization/store/vendor structure and a usable reactive workflow. Configure policies and templates, then commission critical equipment/PM, then add trustworthy history. Provide an operational data-quality queue for duplicates, unmatched Assets/Components, missing Contracts/warranty, unallocated invoice lines, and classification gaps.

## Acceptance evidence

Before calling imports complete, test valid preview/commit, row-level error export, tenant and Store isolation, duplicate detection, idempotent retry, partial/restart behavior, immutable-history protection, authorized reversal, large bounded batches, audit/provenance, and reconciliation to source counts and amounts. None of this proof exists today.
