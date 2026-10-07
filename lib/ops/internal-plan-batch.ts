import type { OpsCommandServices } from "./commands";
import type { OpsRepository, OpsStatement } from "./repository";
import {
  saveInternalSchedule,
  type ScheduleInput,
} from "./internal-scheduling";
import { OpsDomainError } from "./errors";
import { changeInternalDispatch } from "./internal-dispatch";

/** Prepare through the same guarded commands, then commit every job and audit together. */
export async function saveInternalPlanBatch(
  svc: OpsCommandServices,
  inputs: (ScheduleInput & { restoreUnscheduled?: boolean })[],
) {
  if (
    !inputs.length ||
    inputs.length > 25 ||
    new Set(inputs.map((i) => i.workOrderId)).size !== inputs.length
  )
    throw new OpsDomainError(
      "VALIDATION",
      "Select between 1 and 25 different jobs.",
    );
  if (
    inputs.some(
      (i) =>
        i.organizationId !== inputs[0].organizationId ||
        i.actor.actorId !== inputs[0].actor.actorId,
    )
  )
    throw new OpsDomainError("FORBIDDEN", "Plan one organization at a time.");
  const statements: OpsStatement[] = [];
  const repository = new Proxy(svc.repository, {
    get(target, key) {
      if (key === "atomicWrite")
        return async (batch: readonly OpsStatement[]) => {
          statements.push(...batch);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as OpsRepository;
  const now = svc.clock?.now() ?? new Date().toISOString();
  const results = [];
  for (const input of inputs)
    results.push(
      input.restoreUnscheduled
        ? await changeInternalDispatch(
            { ...svc, repository, clock: { now: () => now } },
            {
              organizationId: input.organizationId,
              workOrderId: input.workOrderId,
              actor: input.actor,
              expectedVersion: input.expectedVersion,
              expectedAssignmentId: input.expectedAssignmentId,
              key: input.key,
              action: "assign",
              target: input.target ?? "pool",
              membershipId: input.membershipId,
              managerId: input.managerId,
              reason: input.reviewReason?.trim() || "Undo last Plan change",
            },
          )
        : await saveInternalSchedule(
            { ...svc, repository, clock: { now: () => now } },
            input,
          ),
    );
  if (statements.length) await svc.repository.atomicWrite(statements);
  return results;
}
