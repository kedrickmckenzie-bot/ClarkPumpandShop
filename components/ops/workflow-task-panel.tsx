"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import type {
  SelectOptionViewModel,
  WorkflowTaskItemViewModel,
  WorkflowTaskWorkspaceViewModel,
} from "./data-contract";
import styles from "./ops.module.css";
import { savedReviewHref } from "@/lib/ops/review-navigation";

type MutationState = { pending: boolean; error?: string };

function useTaskMutation() {
  const router = useRouter();
  const [state, setState] = useState<MutationState>({ pending: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const openNext = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "open-next";
    setState({ pending: true });
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setState({ pending: false, error: payload?.error ?? "The task could not be saved." });
        return;
      }
      if (openNext) {
        router.push(savedReviewHref(window.location.href));
      } else window.location.assign(response.url || window.location.href);
    } catch {
      setState({ pending: false, error: "The task could not be saved. Check your connection and try again." });
    }
  }

  return { state, submit };
}

function MutationError({ message }: { message?: string }) {
  return message
    ? <p className={styles.controlError} role="alert"><AlertTriangle aria-hidden="true" size={17} />{message}</p>
    : null;
}

function SelectField({ id, name, label, options, defaultValue, required = true, helper, multiple = false }: {
  id: string;
  name: string;
  label: string;
  options: SelectOptionViewModel[];
  defaultValue?: string | string[];
  required?: boolean;
  helper?: string;
  multiple?: boolean;
}) {
  if (multiple) return <fieldset className={styles.field}><legend>{label}</legend>{options.map((option) => <label key={option.value}><input type="checkbox" name={name} value={option.value} defaultChecked={Array.isArray(defaultValue) && defaultValue.includes(option.value)} /> {option.label}</label>)}{helper ? <small>{helper}</small> : null}</fieldset>;
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{required ? <em>Required</em> : <small>Optional</small>}</span>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? (multiple ? [] : "")} multiple={multiple}>
        {!multiple && !defaultValue ? <option value="" disabled={required}>Select an option</option> : null}
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function CreateWorkflowTaskForm({ model }: { model: WorkflowTaskWorkspaceViewModel }) {
  const { state, submit } = useTaskMutation();
  const [assigneeType, setAssigneeType] = useState("role");
  const [slaMode, setSlaMode] = useState<"due" | "no_sla">("due");

  return (
    <form action={model.createAction} method="post" onSubmit={submit} className={styles.controlForm}>
      <div className={styles.fieldGrid}>
        <SelectField id="workflow-task-type" name="taskType" label="Task type" options={model.taskTypeOptions} defaultValue="other" />
        <SelectField id="workflow-task-priority" name="priority" label="Priority" options={model.priorityOptions} defaultValue="normal" />
      </div>
      <label className={styles.field} htmlFor="workflow-task-title"><span>Required action <em>Required</em></span><input id="workflow-task-title" name="title" required maxLength={240} placeholder="Confirm store access before technician arrival" /></label>
      <label className={styles.field} htmlFor="workflow-task-reason"><span>Why it matters <em>Required</em></span><textarea id="workflow-task-reason" name="reason" required maxLength={2_000} rows={3} placeholder="Explain the operational dependency or decision this task represents." /></label>
      <label className={styles.field} htmlFor="workflow-task-criteria"><span>Done when <em>Required</em></span><textarea id="workflow-task-criteria" name="completionCriteria" required maxLength={2_000} rows={3} placeholder="What needs to happen before this task is done?" /></label>

      <div className={styles.taskFormGroup}>
        <h4>Accountability</h4>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor="workflow-task-assignee-type">
            <span>Assignee type <em>Required</em></span>
            <select id="workflow-task-assignee-type" name="assigneeType" value={assigneeType} onChange={(event) => setAssigneeType(event.target.value)} required>
              {model.assigneeTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          {assigneeType === "user" ? <SelectField id="workflow-task-assignee-user" name="assigneeId" label="Assigned operator" options={model.memberOptions} /> : null}
          {assigneeType === "vendor" ? <SelectField id="workflow-task-assignee-vendor" name="assigneeId" label="Assigned vendor" options={model.vendorOptions} /> : null}
          {assigneeType === "role" ? <SelectField id="workflow-task-assignee-role" name="assigneeRole" label="Assigned role" options={model.roleOptions} /> : null}
          {assigneeType === "team" ? <label className={styles.field} htmlFor="workflow-task-team-id"><span>Team identifier <em>Required</em></span><input id="workflow-task-team-id" name="assigneeId" required maxLength={120} placeholder="internal-maintenance" /></label> : null}
        </div>
        {assigneeType === "team" ? <label className={styles.field} htmlFor="workflow-task-team-name"><span>Team name <em>Required</em></span><input id="workflow-task-team-name" name="assigneeName" required maxLength={200} placeholder="Internal maintenance" /></label> : null}
      </div>

      <div className={styles.taskFormGroup}>
        <h4>Deadline and response target</h4>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor="workflow-task-sla-mode">
            <span>Deadline policy <em>Required</em></span>
            <select id="workflow-task-sla-mode" name="slaMode" value={slaMode} onChange={(event) => setSlaMode(event.target.value as "due" | "no_sla")} required>
              <option value="due">Set a deadline and timer</option>
              <option value="no_sla">No deadline applies</option>
            </select>
          </label>
          {slaMode === "due" ? <SelectField id="workflow-task-sla-clock" name="applicableSlaClock" label="Timer to use" options={model.slaClockOptions} defaultValue="completion" /> : null}
        </div>
        {slaMode === "due"
          ? <label className={styles.field} htmlFor="workflow-task-due"><span>Due at <em>Required</em></span><input id="workflow-task-due" name="dueAt" type="datetime-local" required /></label>
          : <label className={styles.field} htmlFor="workflow-task-no-sla"><span>Why no deadline applies <em>Required</em></span><textarea id="workflow-task-no-sla" name="noSlaReason" required maxLength={1_000} rows={2} placeholder="Explain why this task does not need a deadline." /></label>}
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor="workflow-task-escalation"><span>Escalation destination <em>Required</em></span><input id="workflow-task-escalation" name="escalationDestination" required maxLength={200} placeholder="Facilities director" /></label>
        <div className={styles.taskChecks}>
          <label><input type="checkbox" name="blocking" value="true" /><span>Progress is blocked until this is resolved</span></label>
          <label><input type="checkbox" name="requiredForProgress" value="true" defaultChecked /><span>Required before the workflow advances</span></label>
        </div>
      </div>
      <MutationError message={state.error} />
      <div className={styles.formFooter}>
        <span className={styles.formMeta}>Other tasks stay open.</span>
        <button className={styles.primaryButton} type="submit" disabled={state.pending}>{state.pending ? "Creating…" : "Create task"}<Plus aria-hidden="true" size={17} /></button>
      </div>
    </form>
  );
}

function TaskOperationForm({ task, operation, label, icon, children, destructive = false }: {
  task: WorkflowTaskItemViewModel;
  operation: WorkflowTaskItemViewModel["availableActions"][number];
  label: string;
  icon: ReactNode;
  children?: ReactNode;
  destructive?: boolean;
}) {
  const { state, submit } = useTaskMutation();
  const reviewParams = useSearchParams();
  const canOpenNext = operation === "complete" && reviewParams.get("reviewItem") === task.id && Boolean(reviewParams.get("reviewQueue"));
  const simple = !children;
  const form = (
    <form action={task.action} method="post" onSubmit={submit} className={simple ? styles.taskQuickForm : styles.controlForm}>
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="expectedStatus" value={task.status} />
      {task.activePauseId ? <input type="hidden" name="expectedPauseId" value={task.activePauseId} /> : null}
      {children}
      <MutationError message={state.error} />
      <div className={simple ? undefined : styles.formFooter}>
        <button className={destructive ? styles.dangerButton : simple ? styles.taskQuickButton : styles.secondaryButton} type="submit" disabled={state.pending}>{state.pending ? "Saving…" : label}{icon}</button>
        {canOpenNext ? <button className={styles.primaryButton} type="submit" name="afterSave" value="open-next" disabled={state.pending}>Save and open next</button> : null}
      </div>
    </form>
  );
  if (simple) return form;
  return (
    <details className={styles.taskActionDisclosure}>
      <summary>{icon}<span>{label}</span></summary>
      {form}
    </details>
  );
}

function TaskActions({ task, model }: { task: WorkflowTaskItemViewModel; model: WorkflowTaskWorkspaceViewModel }) {
  const has = (operation: WorkflowTaskItemViewModel["availableActions"][number]) => task.availableActions.includes(operation);
  return (
    <div className={styles.taskActions} aria-label={`Actions for ${task.title}`}>
      {has("start") ? <TaskOperationForm task={task} operation="start" label="Start task" icon={<PlayCircle aria-hidden="true" size={16} />} /> : null}
      {has("complete") ? <TaskOperationForm task={task} operation="complete" label="Complete" icon={<CheckCircle2 aria-hidden="true" size={16} />}>
        <label className={styles.field} htmlFor={`task-resolution-${task.id}`}><span>Resolution note <em>Required</em></span><textarea id={`task-resolution-${task.id}`} name="resolutionNote" required maxLength={2_000} rows={3} placeholder="Record the source fact that satisfied the completion criteria." /></label>
      </TaskOperationForm> : null}
      {has("pause") ? <PauseTaskForm task={task} model={model} /> : null}
      {has("resume") ? <TaskOperationForm task={task} operation="resume" label="Resume timer" icon={<PlayCircle aria-hidden="true" size={16} />}>
        <label className={styles.field} htmlFor={`task-resume-note-${task.id}`}><span>Resume note <small>Optional</small></span><textarea id={`task-resume-note-${task.id}`} name="note" maxLength={2_000} rows={2} placeholder="Record what changed and why the affected clocks can resume." /></label>
      </TaskOperationForm> : null}
      {has("escalate") ? <TaskOperationForm task={task} operation="escalate" label="Escalate" icon={<ArrowUpRight aria-hidden="true" size={16} />}>
        <label className={styles.field} htmlFor={`task-escalation-destination-${task.id}`}><span>New escalation destination <em>Required</em></span><input id={`task-escalation-destination-${task.id}`} name="escalationDestination" required maxLength={200} defaultValue={task.escalationDestination} /></label>
        <label className={styles.field} htmlFor={`task-escalation-note-${task.id}`}><span>Escalation reason <em>Required</em></span><textarea id={`task-escalation-note-${task.id}`} name="reason" required maxLength={2_000} rows={2} placeholder="Why does this need additional help or approval?" /></label>
      </TaskOperationForm> : null}
      {has("cancel") ? <TaskOperationForm task={task} operation="cancel" label="Cancel task" icon={<XCircle aria-hidden="true" size={16} />} destructive>
        <label className={styles.field} htmlFor={`task-cancel-note-${task.id}`}><span>Cancellation reason <em>Required</em></span><textarea id={`task-cancel-note-${task.id}`} name="resolutionNote" required maxLength={2_000} rows={2} placeholder="Why is this task no longer needed?" /></label>
      </TaskOperationForm> : null}
    </div>
  );
}

function PauseTaskForm({ task, model }: { task: WorkflowTaskItemViewModel; model: WorkflowTaskWorkspaceViewModel }) {
  const { state, submit } = useTaskMutation();
  const [ownerType, setOwnerType] = useState("external_party");
  const defaultClock = model.slaClockOptions.find((option) => option.label === task.slaClockLabel)?.value;
  return (
    <details className={styles.taskActionDisclosure}>
      <summary><PauseCircle aria-hidden="true" size={16} /><span>Pause response or completion timer</span></summary>
      <form action={task.action} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value="pause" />
        <input type="hidden" name="expectedStatus" value={task.status} />
        <div className={styles.fieldGrid}>
          <SelectField id={`task-pause-reason-${task.id}`} name="reasonCode" label="Structured pause reason" options={model.pauseReasonOptions} />
          <SelectField id={`task-pause-clocks-${task.id}`} name="affectedClocks" label="Timers to pause" options={model.slaClockOptions} defaultValue={defaultClock ? [defaultClock] : []} multiple helper="Select each timer that should pause." />
        </div>
        <label className={styles.field} htmlFor={`task-pause-detail-${task.id}`}><span>Hold detail <em>Required</em></span><textarea id={`task-pause-detail-${task.id}`} name="reasonDetail" required maxLength={2_000} rows={3} placeholder="State the external dependency or condition preventing progress." /></label>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`task-pause-owner-type-${task.id}`}><span>Hold owner type <em>Required</em></span><select id={`task-pause-owner-type-${task.id}`} name="ownerType" required value={ownerType} onChange={(event) => setOwnerType(event.target.value)}>{model.pauseOwnerTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <label className={styles.field} htmlFor={`task-pause-owner-${task.id}`}><span>Hold owner name <em>Required</em></span><input id={`task-pause-owner-${task.id}`} name="ownerName" required maxLength={200} placeholder={ownerType === "vendor" ? "Vendor dispatch" : "Named responsible party"} /></label>
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`task-pause-owner-id-${task.id}`}><span>Hold owner identifier <small>Optional</small></span><input id={`task-pause-owner-id-${task.id}`} name="ownerId" maxLength={120} /></label>
          <label className={styles.field} htmlFor={`task-pause-resume-${task.id}`}><span>Expected resume <small>Optional</small></span><input id={`task-pause-resume-${task.id}`} name="expectedResumeAt" type="datetime-local" /></label>
        </div>
        <MutationError message={state.error} />
        <div className={styles.formFooter}><button className={styles.secondaryButton} type="submit" disabled={state.pending}>{state.pending ? "Recording…" : "Pause selected timers"}<PauseCircle aria-hidden="true" size={16} /></button></div>
      </form>
    </details>
  );
}

function PauseLedger({ task }: { task: WorkflowTaskItemViewModel }) {
  if (!task.pauses.length) return null;
  return (
    <div className={styles.pauseLedger}>
      <h4><History aria-hidden="true" size={15} />Timer history</h4>
      <ol>
        {task.pauses.map((pause) => (
          <li key={pause.id} data-state={pause.state}>
            <span><strong>{pause.reasonLabel}</strong><small>{pause.state === "active" ? "Active hold" : "Resumed"}</small></span>
            <p>{pause.reasonDetail}</p>
            <dl>
              <div><dt>Hold owner</dt><dd>{pause.ownerLabel}</dd></div>
              <div><dt>Clocks paused</dt><dd>{pause.affectedClocksLabel}</dd></div>
              <div><dt>Paused</dt><dd>{pause.pausedLabel} · {pause.pausedByLabel}</dd></div>
              <div><dt>Expected resume</dt><dd>{pause.expectedResumeLabel ?? "Not estimated"}</dd></div>
              {pause.resumedLabel ? <div><dt>Resumed</dt><dd>{pause.resumedLabel} · {pause.resumedByLabel}{pause.resumeNote ? ` · ${pause.resumeNote}` : ""}</dd></div> : null}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WorkflowTaskRecord({ task, model, active }: { task: WorkflowTaskItemViewModel; model: WorkflowTaskWorkspaceViewModel; active: boolean }) {
  return (
    <article id={`workflow-task-${task.id}`} className={styles.workflowTask} data-blocking={task.blocking ? "true" : "false"} data-state={task.status}>
      <header>
        <div className={styles.taskIdentity}>
          <span><small>{task.typeLabel}</small><strong>{task.title}</strong></span>
          <div className={styles.taskBadges}>
            <em data-tone={task.statusTone}><CircleDot aria-hidden="true" size={12} />{task.statusLabel}</em>
            {task.blocking ? <em data-tone="critical"><ShieldAlert aria-hidden="true" size={12} />Blocking</em> : null}
            <em>{task.priorityLabel}</em>
          </div>
        </div>
        <p>{task.reason}</p>
        {task.evidenceHref ? <a href={task.evidenceHref}>Open the diagnosis, prior repair and warranty terms →</a> : null}
      </header>
      <dl className={styles.taskFacts}>
        <div><dt><UserRound aria-hidden="true" size={14} />Who acts</dt><dd>{task.assigneeLabel}<small>{task.assigneeTypeLabel}</small></dd></div>
        <div><dt><CalendarClock aria-hidden="true" size={14} />When</dt><dd>{task.dueLabel}<small>{task.noSlaReason ? `No deadline: ${task.noSlaReason}` : task.slaClockLabel ? `${task.slaClockLabel} clock` : "Deadline recorded"}</small></dd></div>
        <div><dt><CheckCircle2 aria-hidden="true" size={14} />Done when</dt><dd>{task.completionCriteria}<small>{task.requiredForProgress ? "Required for progress" : "Other work can continue while this task is open."}</small></dd></div>
        <div><dt><ArrowUpRight aria-hidden="true" size={14} />Escalation</dt><dd>{task.escalationDestination}<small>Level {task.escalationLevel}</small></dd></div>
      </dl>
      <footer className={styles.taskRecordMeta}>
        <span>Created {task.createdLabel} by {task.createdByLabel}</span>
        {task.startedLabel ? <span>Started {task.startedLabel}</span> : null}
        {task.completedLabel ? <span>Completed {task.completedLabel}</span> : null}
        {task.cancelledLabel ? <span>Cancelled {task.cancelledLabel}</span> : null}
        {task.resolutionNote ? <strong>{task.resolutionNote}</strong> : null}
      </footer>
      <PauseLedger task={task} />
      {active && model.permitted ? <TaskActions task={task} model={model} /> : null}
    </article>
  );
}

export function WorkflowTaskPanel({ model }: { model: WorkflowTaskWorkspaceViewModel }) {
  return (
    <section className={styles.controlPanel} id="workflow-tasks" aria-labelledby="workflow-tasks-heading">
      <div className={styles.controlHeading}>
        <span><Clock3 aria-hidden="true" size={19} /></span>
        <div><h2 id="workflow-tasks-heading">Tasks and follow-ups</h2><p>See who needs to act, the deadline, and what is needed to finish each task.</p></div>
      </div>
      <div className={styles.taskSummary}>
        <span><small>Open tasks</small><strong>{model.activeTasks.length}</strong></span>
        <span><small>Blocking now</small><strong>{model.activeTasks.filter((task) => task.blocking).length}</strong></span>
        <span><small>Timer paused</small><strong>{model.activeTasks.filter((task) => task.activePauseId).length}</strong></span>
        <span><small>Historical tasks</small><strong>{model.history.length}</strong></span>
      </div>

      {model.activeTasks.length ? (
        <div className={styles.workflowTaskList} aria-label="Open tasks">
          {model.activeTasks.map((task) => <WorkflowTaskRecord task={task} model={model} active key={task.id} />)}
        </div>
      ) : (
        <div className={styles.taskEmpty}><CheckCircle2 aria-hidden="true" size={21} /><div><strong>No open tasks</strong><p>Open work needs a responsible person and a next action or planned date.</p></div></div>
      )}

      {!model.permitted ? <p className={styles.inlineEmpty}><ShieldAlert aria-hidden="true" size={18} />{model.permissionMessage}</p> : (
        <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
          <summary className={styles.subControlHeading}><Plus aria-hidden="true" size={18} /><div><h3>Add a task</h3><p>Assign additional work with its own owner and deadline.</p></div></summary>
          <CreateWorkflowTaskForm model={model} />
        </details>
      )}

      <section className={styles.taskHistory} aria-labelledby="workflow-task-history-heading">
        <header><History aria-hidden="true" size={17} /><div><h3 id="workflow-task-history-heading">Completed and canceled tasks</h3><p>Review completed tasks, notes, and timer changes.</p></div></header>
        {model.history.length
          ? <div className={styles.workflowTaskList}>{model.history.map((task) => <WorkflowTaskRecord task={task} model={model} active={false} key={task.id} />)}</div>
          : <p className={styles.taskHistoryEmpty}>No task has reached a terminal state yet.</p>}
      </section>
    </section>
  );
}
