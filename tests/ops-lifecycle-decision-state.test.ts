import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  loadSession: vi.fn(),
}));

vi.mock("@/lib/server/ops-repository-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-repository-provider")>("@/lib/server/ops-repository-provider");
  return { ...actual, getServerOpsFixtureSnapshot: mocks.getSnapshot };
});

vi.mock("@/app/app/_data/operator-loader", async () => {
  const actual = await vi.importActual<typeof import("@/app/app/_data/operator-loader")>("@/app/app/_data/operator-loader");
  return { ...actual, loadOperatorSession: mocks.loadSession };
});

let buildProgramModel: typeof import("@/app/app/_data/operator-presenter").buildProgramModel;
let loadLifecycleRecordStack: typeof import("@/app/app/_data/lifecycle-workspace-loader").loadLifecycleRecordStack;

function session(): OperatorSession {
  return {
    userId: "user-northline-executive",
    membershipId: "membership-northline-executive",
    displayName: "Alex Morgan",
    email: "alex.morgan@clark-demo.example",
    role: "executive",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    permissions: ["ops:*"],
  };
}

beforeAll(async () => {
  ({ buildProgramModel } = await import("@/app/app/_data/operator-presenter"));
  ({ loadLifecycleRecordStack } = await import("@/app/app/_data/lifecycle-workspace-loader"));
});

beforeEach(() => vi.clearAllMocks());

describe("shared lifecycle decision state", () => {
  it("shows the same recorded decision in the lifecycle list and its decision workspace", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const operatorSession = session();
    mocks.getSnapshot.mockResolvedValue(fixture);
    mocks.loadSession.mockResolvedValue(operatorSession);

    const list = buildProgramModel(fixture, operatorSession, "lifecycle", { view: "review" });
    const row = list.table!.rows.find((candidate) => candidate.id === "asset-115-beer-cave")!;
    const workspace = await loadLifecycleRecordStack("asset-115-beer-cave", {
      view: "review",
      decision: "asset-115-beer-cave",
    });

    const listDecision = row.cells.find((cell) => cell.key === "status")?.value;
    expect(listDecision).toBe("Replacement approved");
    expect(row.cells.find((cell) => cell.key === "evidence")?.value).toBe(listDecision);
    expect(workspace?.model.statusLabel).toBe(listDecision);
    expect(workspace?.model.decisionLabel).toBe(listDecision);
  });
});
