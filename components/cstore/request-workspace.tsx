"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useId,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileLock2,
  Inbox,
  MapPin,
  Paperclip,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import type { WorkPriority } from "../../lib/cstore/types";
import styles from "./request-workspace.module.css";

export interface RequestWorkspaceStore {
  id: string;
  storeNumber: string;
  name: string;
  address: string;
}

export interface EmployeeIssueDraft {
  employeeName: string;
  employeeId: string;
  problem: string;
  reportedLocation: string;
  urgency: WorkPriority;
  photo: File | null;
}

export interface SubmittedRequestReceipt {
  requestId: string;
  requestNumber?: string;
  submittedAtLabel?: string;
}

export interface RequestInboxItem {
  id: string;
  requestNumber?: string;
  store: RequestWorkspaceStore;
  submittedByName: string;
  submittedByEmployeeId: string;
  submittedAt: string;
  submittedAtLabel?: string;
  immutableDescription: string;
  reportedLocation: string;
  urgency: WorkPriority;
  categoryHint?: string;
  attachmentCount: number;
  reviewStatus: "new" | "reviewed" | "converted";
  linkedWorkOrderId?: string;
  linkedWorkOrderNumber?: string;
}

export type RequestInboxFilter = "needs_review" | "all" | "converted";

export interface RequestInboxValue {
  query: string;
  filter: RequestInboxFilter;
  selectedRequestId: string | null;
}

interface RequestWorkspaceSharedProps {
  className?: string;
  demoMode?: boolean;
}

export interface EmployeeRequestWorkspaceProps extends RequestWorkspaceSharedProps {
  mode: "employee";
  store: RequestWorkspaceStore;
  value: EmployeeIssueDraft;
  onChange: (value: EmployeeIssueDraft) => void;
  onSubmit: (value: EmployeeIssueDraft) => void | Promise<void>;
  isSubmitting?: boolean;
  receipt?: SubmittedRequestReceipt | null;
  onReportAnother?: () => void;
}

export interface ManagerRequestWorkspaceProps extends RequestWorkspaceSharedProps {
  mode: "manager";
  scopeLabel: string;
  requests: RequestInboxItem[];
  value: RequestInboxValue;
  onChange: (value: RequestInboxValue) => void;
  onApproveAndCreateWorkOrder: (requestId: string) => void | Promise<void>;
  approvingRequestId?: string | null;
  onOpenWorkOrder?: (workOrderId: string) => void;
}

export type RequestWorkspaceProps =
  | EmployeeRequestWorkspaceProps
  | ManagerRequestWorkspaceProps;

const priorityOptions: Array<{
  value: WorkPriority;
  label: string;
  description: string;
}> = [
  {
    value: "routine",
    label: "Routine",
    description: "Can be handled during normal service.",
  },
  {
    value: "soon",
    label: "Needs attention",
    description: "Affecting the store, but still operating.",
  },
  {
    value: "urgent",
    label: "Urgent",
    description: "Product, equipment, or service is at risk.",
  },
  {
    value: "emergency",
    label: "Emergency",
    description: "Immediate safety risk or store shutdown.",
  },
];

const filterOptions: Array<{ value: RequestInboxFilter; label: string }> = [
  { value: "needs_review", label: "Needs review" },
  { value: "all", label: "All requests" },
  { value: "converted", label: "Work order created" },
];

const priorityLabels: Record<WorkPriority, string> = {
  routine: "Routine",
  soon: "Needs attention",
  urgent: "Urgent",
  emergency: "Emergency",
};

function classes(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function urgencyClass(urgency: WorkPriority) {
  if (urgency === "emergency") return styles.emergency;
  if (urgency === "urgent") return styles.urgent;
  if (urgency === "soon") return styles.soon;
  return styles.routine;
}

function updateDraft<K extends keyof EmployeeIssueDraft>(
  value: EmployeeIssueDraft,
  onChange: (value: EmployeeIssueDraft) => void,
  key: K,
  nextValue: EmployeeIssueDraft[K],
) {
  onChange({ ...value, [key]: nextValue });
}

export function RequestWorkspace(props: RequestWorkspaceProps) {
  if (props.mode === "employee") {
    return <EmployeeIssueWorkspace {...props} />;
  }

  return <ManagerRequestInbox {...props} />;
}

function EmployeeIssueWorkspace({
  store,
  value,
  onChange,
  onSubmit,
  isSubmitting: submittingFromParent = false,
  receipt,
  onReportAnother,
  demoMode = true,
  className,
}: EmployeeRequestWorkspaceProps) {
  const formId = useId();
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = submittingFromParent || localSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (value.employeeName.trim().length < 2) {
      setError("Enter your name so the manager knows who reported the issue.");
      return;
    }
    if (!value.employeeId.trim()) {
      setError("Enter your employee ID.");
      return;
    }
    if (value.problem.trim().length < 12) {
      setError("Describe what you can see, hear, smell, or measure.");
      return;
    }
    if (!value.reportedLocation.trim()) {
      setError("Tell the manager where in the store the problem is located.");
      return;
    }

    try {
      setLocalSubmitting(true);
      await onSubmit({
        ...value,
        employeeName: value.employeeName.trim(),
        employeeId: value.employeeId.trim(),
        problem: value.problem.trim(),
        reportedLocation: value.reportedLocation.trim(),
      });
    } catch {
      setError("The request was not submitted. Your entries are still here; please try again.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    updateDraft(value, onChange, "photo", event.target.files?.[0] ?? null);
    setError(null);
  }

  if (receipt) {
    return (
      <section
        className={classes(styles.root, styles.surface, styles.confirmation, className)}
        aria-labelledby={`${formId}-confirmation-title`}
      >
        <div className={styles.confirmationIcon}>
          <CheckCircle2 aria-hidden="true" />
        </div>
        <span className={styles.eyebrow}>Request submitted</span>
        <h2 id={`${formId}-confirmation-title`}>The store manager can review it now.</h2>
        <p>
          Your original report is saved as submitted. It cannot be edited or deleted from the
          manager review screen.
        </p>
        <dl className={styles.receiptDetails}>
          <div>
            <dt>Request</dt>
            <dd>{receipt.requestNumber ?? receipt.requestId}</dd>
          </div>
          <div>
            <dt>Store</dt>
            <dd>#{store.storeNumber} · {store.name}</dd>
          </div>
          {receipt.submittedAtLabel ? (
            <div>
              <dt>Submitted</dt>
              <dd>{receipt.submittedAtLabel}</dd>
            </div>
          ) : null}
        </dl>
        {demoMode ? (
          <p className={styles.demoNote}>
            Demo Mode · This request lasts for this browser session and may reset on refresh.
          </p>
        ) : null}
        {onReportAnother ? (
          <button className={styles.secondaryButton} type="button" onClick={onReportAnother}>
            Report another issue
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <form
      className={classes(styles.root, styles.surface, className)}
      onSubmit={handleSubmit}
      noValidate
    >
      <header className={styles.employeeHeader}>
        <div>
          <span className={styles.eyebrow}>Store portal</span>
          <h2>Report an issue</h2>
          <p>Tell the manager what you noticed. You do not need to diagnose the problem.</p>
        </div>
        {demoMode ? <span className={styles.demoBadge}>Demo Mode</span> : null}
      </header>

      <div className={styles.formBody}>
        <section className={styles.storeContext} aria-label="Selected store">
          <span className={styles.storeIcon}>
            <Building2 aria-hidden="true" />
          </span>
          <div>
            <span>You are reporting for</span>
            <strong>Store {store.storeNumber} · {store.name}</strong>
            <small>{store.address}</small>
          </div>
          <ShieldCheck aria-label="Store fixed by this portal" />
        </section>

        <section className={styles.formSection} aria-labelledby={`${formId}-reporter-title`}>
          <div className={styles.sectionHeading}>
            <span>1</span>
            <div>
              <h3 id={`${formId}-reporter-title`}>Who is reporting it?</h3>
              <p>The manager may need to ask what you observed.</p>
            </div>
          </div>
          <div className={styles.twoColumnFields}>
            <label className={styles.field} htmlFor={`${formId}-employee-name`}>
              <span>Your name</span>
              <span className={styles.inputWithIcon}>
                <UserRound aria-hidden="true" />
                <input
                  id={`${formId}-employee-name`}
                  type="text"
                  value={value.employeeName}
                  onChange={(event) => {
                    updateDraft(value, onChange, "employeeName", event.target.value);
                    setError(null);
                  }}
                  autoComplete="name"
                  placeholder="First and last name"
                  required
                />
              </span>
            </label>
            <label className={styles.field} htmlFor={`${formId}-employee-id`}>
              <span>Employee ID</span>
              <input
                id={`${formId}-employee-id`}
                type="text"
                value={value.employeeId}
                onChange={(event) => {
                  updateDraft(value, onChange, "employeeId", event.target.value);
                  setError(null);
                }}
                autoComplete="off"
                placeholder="e.g. 4817"
                required
              />
            </label>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby={`${formId}-problem-title`}>
          <div className={styles.sectionHeading}>
            <span>2</span>
            <div>
              <h3 id={`${formId}-problem-title`}>What needs attention?</h3>
              <p>Describe only what you know. The manager can classify equipment later.</p>
            </div>
          </div>
          <div className={styles.problemFields}>
            <label className={styles.field} htmlFor={`${formId}-problem`}>
              <span>What did you notice?</span>
              <textarea
                id={`${formId}-problem`}
                value={value.problem}
                onChange={(event) => {
                  updateDraft(value, onChange, "problem", event.target.value);
                  setError(null);
                }}
                placeholder="Example: The beer cave feels warm and the display reads 48°F. Product on the top shelf is not cold."
                minLength={12}
                rows={5}
                required
              />
              <small>Include readings, sounds, smells, leaks, or anything that looks unusual.</small>
            </label>
            <label className={styles.field} htmlFor={`${formId}-location`}>
              <span>Where is it?</span>
              <span className={styles.inputWithIcon}>
                <MapPin aria-hidden="true" />
                <input
                  id={`${formId}-location`}
                  type="text"
                  value={value.reportedLocation}
                  onChange={(event) => {
                    updateDraft(value, onChange, "reportedLocation", event.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Beer cave, back wall"
                  required
                />
              </span>
            </label>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby={`${formId}-urgency-title`}>
          <div className={styles.sectionHeading}>
            <span>3</span>
            <div>
              <h3 id={`${formId}-urgency-title`}>How urgent is it?</h3>
              <p>Choose the closest description. A manager will confirm the priority.</p>
            </div>
          </div>
          <fieldset className={styles.priorityFieldset}>
            <legend className={styles.srOnly}>Issue urgency</legend>
            <div className={styles.priorityGrid}>
              {priorityOptions.map((option) => {
                const inputId = `${formId}-urgency-${option.value}`;
                return (
                  <label
                    key={option.value}
                    className={classes(
                      styles.priorityOption,
                      value.urgency === option.value && styles.priorityOptionSelected,
                      value.urgency === option.value && urgencyClass(option.value),
                    )}
                    htmlFor={inputId}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`${formId}-urgency`}
                      value={option.value}
                      checked={value.urgency === option.value}
                      onChange={() => updateDraft(value, onChange, "urgency", option.value)}
                    />
                    <span aria-hidden="true" />
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section className={styles.formSection} aria-labelledby={`${formId}-photo-title`}>
          <div className={styles.sectionHeading}>
            <span>4</span>
            <div>
              <h3 id={`${formId}-photo-title`}>Add a photo</h3>
              <p>Optional. A clear photo can help the manager choose the right service provider.</p>
            </div>
          </div>
          {value.photo ? (
            <div className={styles.fileSelected}>
              <span className={styles.fileIcon}>
                <Paperclip aria-hidden="true" />
              </span>
              <span>
                <strong>{value.photo.name}</strong>
                <small>{Math.max(1, Math.round(value.photo.size / 1024))} KB · Ready to attach</small>
              </span>
              <button
                type="button"
                onClick={() => updateDraft(value, onChange, "photo", null)}
                aria-label={`Remove ${value.photo.name}`}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className={styles.photoInput} htmlFor={`${formId}-photo`}>
              <Camera aria-hidden="true" />
              <span>
                <strong>Take a photo or choose one</strong>
                <small>JPG, PNG, or HEIC</small>
              </span>
              <input
                key="empty-photo"
                id={`${formId}-photo`}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
              />
            </label>
          )}
        </section>

        {error ? (
          <p className={styles.error} role="alert">
            <CircleAlert aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>

      <footer className={styles.formFooter}>
        <p>
          <FileLock2 aria-hidden="true" />
          Your report is preserved exactly as submitted.
        </p>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit request"}
          <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </form>
  );
}

function ManagerRequestInbox({
  scopeLabel,
  requests,
  value,
  onChange,
  onApproveAndCreateWorkOrder,
  approvingRequestId: approvingFromParent = null,
  onOpenWorkOrder,
  demoMode = true,
  className,
}: ManagerRequestWorkspaceProps) {
  const headingId = useId();
  const [localApprovingId, setLocalApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approvingRequestId = approvingFromParent ?? localApprovingId;
  const normalizedQuery = value.query.trim().toLowerCase();

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (value.filter === "needs_review" && request.reviewStatus === "converted") return false;
      if (value.filter === "converted" && request.reviewStatus !== "converted") return false;
      if (!normalizedQuery) return true;

      return [
        request.requestNumber,
        request.store.storeNumber,
        request.store.name,
        request.store.address,
        request.submittedByName,
        request.submittedByEmployeeId,
        request.immutableDescription,
        request.reportedLocation,
        request.categoryHint,
        request.linkedWorkOrderNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [normalizedQuery, requests, value.filter]);

  const selectedRequest =
    filteredRequests.find((request) => request.id === value.selectedRequestId) ??
    filteredRequests[0] ??
    null;
  const needsReviewCount = requests.filter(
    (request) => request.reviewStatus !== "converted",
  ).length;

  function updateInbox(next: Partial<RequestInboxValue>) {
    onChange({ ...value, ...next });
    setError(null);
  }

  async function approveRequest(requestId: string) {
    setError(null);
    try {
      setLocalApprovingId(requestId);
      await onApproveAndCreateWorkOrder(requestId);
    } catch {
      setError("The work order was not created. The original request is unchanged; please try again.");
    } finally {
      setLocalApprovingId(null);
    }
  }

  return (
    <section
      className={classes(styles.root, styles.managerRoot, className)}
      aria-labelledby={headingId}
    >
      <header className={styles.managerHeader}>
        <div>
          <span className={styles.eyebrow}>Manager workspace</span>
          <h2 id={headingId}>Review store requests</h2>
          <p>{scopeLabel} · Approve legitimate needs before choosing an internal team or vendor.</p>
        </div>
        <div className={styles.headerStatus}>
          {demoMode ? <span className={styles.demoBadge}>Demo Mode</span> : null}
          <span className={styles.countBadge}>
            <Inbox aria-hidden="true" />
            {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
          </span>
        </div>
      </header>

      <div className={styles.inboxLayout}>
        <aside className={styles.inboxRail} aria-label="Request inbox">
          <div className={styles.inboxControls}>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Search requests</span>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={value.query}
                onChange={(event) => updateInbox({ query: event.target.value })}
                placeholder="Search request, store, or employee"
              />
            </label>
            <div className={styles.filterRow} aria-label="Filter requests">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={value.filter === option.value ? styles.filterActive : undefined}
                  onClick={() => updateInbox({ filter: option.value })}
                  aria-pressed={value.filter === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.requestList}>
            {filteredRequests.length ? (
              filteredRequests.map((request) => {
                const selected = selectedRequest?.id === request.id;
                return (
                  <button
                    type="button"
                    key={request.id}
                    className={classes(styles.requestCard, selected && styles.requestCardSelected)}
                    onClick={() => updateInbox({ selectedRequestId: request.id })}
                    aria-pressed={selected}
                  >
                    <span className={styles.requestCardTopline}>
                      <span className={classes(styles.urgencyBadge, urgencyClass(request.urgency))}>
                        {priorityLabels[request.urgency]}
                      </span>
                      <time dateTime={request.submittedAt}>
                        {request.submittedAtLabel ?? formatSubmittedAt(request.submittedAt)}
                      </time>
                    </span>
                    <strong>
                      Store {request.store.storeNumber} · {request.reportedLocation}
                    </strong>
                    <span className={styles.requestSnippet}>{request.immutableDescription}</span>
                    <span className={styles.requestCardMeta}>
                      {request.submittedByName}
                      {request.attachmentCount > 0
                        ? ` · ${request.attachmentCount} photo${request.attachmentCount === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    {request.reviewStatus === "converted" ? (
                      <span className={styles.convertedLabel}>
                        <CheckCircle2 aria-hidden="true" />
                        {request.linkedWorkOrderNumber ?? "Work order created"}
                      </span>
                    ) : null}
                    <ChevronRight className={styles.requestChevron} aria-hidden="true" />
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyInbox}>
                <Search aria-hidden="true" />
                <strong>No requests match</strong>
                <p>Try a different search or request status.</p>
              </div>
            )}
          </div>
        </aside>

        <main className={styles.reviewPane}>
          {selectedRequest ? (
            <RequestReview
              request={selectedRequest}
              isApproving={approvingRequestId === selectedRequest.id}
              error={error}
              onApprove={() => void approveRequest(selectedRequest.id)}
              onOpenWorkOrder={onOpenWorkOrder}
            />
          ) : (
            <div className={styles.emptyReview}>
              <Inbox aria-hidden="true" />
              <h3>Select a request</h3>
              <p>Choose a store request to read the original report and decide what happens next.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function RequestReview({
  request,
  isApproving,
  error,
  onApprove,
  onOpenWorkOrder,
}: {
  request: RequestInboxItem;
  isApproving: boolean;
  error: string | null;
  onApprove: () => void;
  onOpenWorkOrder?: (workOrderId: string) => void;
}) {
  const titleId = useId();
  const isConverted = request.reviewStatus === "converted";

  return (
    <article className={styles.reviewCard} aria-labelledby={titleId}>
      <header className={styles.reviewHeader}>
        <div>
          <span className={styles.requestReference}>
            {request.requestNumber ?? `Request ${request.id}`}
          </span>
          <h3 id={titleId}>Store {request.store.storeNumber} · {request.reportedLocation}</h3>
          <p>{request.store.name} · {request.store.address}</p>
        </div>
        <span className={classes(styles.urgencyBadge, urgencyClass(request.urgency))}>
          {priorityLabels[request.urgency]}
        </span>
      </header>

      <div className={styles.immutableBanner}>
        <FileLock2 aria-hidden="true" />
        <span>
          <strong>Original employee report</strong>
          Read-only · preserved exactly as submitted
        </span>
      </div>

      <blockquote className={styles.originalReport}>“{request.immutableDescription}”</blockquote>

      <dl className={styles.requestFacts}>
        <div>
          <dt>Submitted by</dt>
          <dd>{request.submittedByName}</dd>
          <small>Employee #{request.submittedByEmployeeId}</small>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>
            <time dateTime={request.submittedAt}>
              {request.submittedAtLabel ?? formatSubmittedAt(request.submittedAt)}
            </time>
          </dd>
          <small>Store portal</small>
        </div>
        <div>
          <dt>Reported location</dt>
          <dd>{request.reportedLocation}</dd>
          <small>{request.categoryHint ?? "Classification can be added later"}</small>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {request.attachmentCount
              ? `${request.attachmentCount} photo${request.attachmentCount === 1 ? "" : "s"}`
              : "No photos"}
          </dd>
          <small>Attached to this request</small>
        </div>
      </dl>

      {request.attachmentCount > 0 ? (
        <div className={styles.evidenceStrip}>
          <span className={styles.evidenceIcon}>
            <Camera aria-hidden="true" />
          </span>
          <span>
            <strong>
              {request.attachmentCount} employee photo{request.attachmentCount === 1 ? "" : "s"}
            </strong>
            <small>Available to carry forward with the work order</small>
          </span>
          <span className={styles.readOnlyLabel}>Original evidence</span>
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <footer className={styles.reviewFooter}>
        {isConverted ? (
          <>
            <div className={styles.approvedSummary}>
              <CheckCircle2 aria-hidden="true" />
              <span>
                <strong>{request.linkedWorkOrderNumber ?? "Work order created"}</strong>
                The original request remains linked as its source.
              </span>
            </div>
            {request.linkedWorkOrderId && onOpenWorkOrder ? (
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => onOpenWorkOrder(request.linkedWorkOrderId!)}
              >
                Open work order
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className={styles.nextStepCopy}>
              <Clock3 aria-hidden="true" />
              <span>
                <strong>Ready for manager approval</strong>
                Approving creates the customer work-order number. Vendor selection comes next.
              </span>
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={onApprove}
              disabled={isApproving}
            >
              {isApproving ? "Creating work order…" : "Approve & create work order"}
              <ArrowRight aria-hidden="true" />
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
