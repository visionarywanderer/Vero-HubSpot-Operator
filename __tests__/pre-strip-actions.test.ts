import { describe, it, expect } from "vitest";
import { preStripBrokenActions, getKnownBrokenActionTypes } from "@/lib/partial-install";

describe("getKnownBrokenActionTypes", () => {
  it("returns universally broken action types without portal context", () => {
    const broken = getKnownBrokenActionTypes();
    expect(broken.has("0-9")).toBe(true);
    expect(broken.has("0-11")).toBe(true);
  });

  it("does not include working action types", () => {
    const broken = getKnownBrokenActionTypes();
    expect(broken.has("0-5")).toBe(false);
    expect(broken.has("0-8")).toBe(false);
    expect(broken.has("0-35")).toBe(false);
  });
});

describe("preStripBrokenActions", () => {
  const basePayload = {
    name: "[VD] Test Workflow",
    type: "CONTACT_FLOW",
    objectTypeId: "0-1",
    startActionId: "1",
    nextAvailableActionId: "5",
    actions: [
      { actionId: "1", actionTypeId: "0-5", connection: { nextActionId: "2" } },
      { actionId: "2", actionTypeId: "0-9", connection: { nextActionId: "3" } }, // broken
      { actionId: "3", actionTypeId: "0-8", connection: { nextActionId: "4" } },
      { actionId: "4", actionTypeId: "0-11", connection: {} }, // broken
    ],
    enrollmentCriteria: { type: "STATIC_LIST" },
  };

  it("strips known broken actions (0-9, 0-11)", () => {
    const result = preStripBrokenActions(basePayload, "Test Workflow");
    const remainingTypeIds = (result.payload.actions as Array<Record<string, unknown>>)
      .map((a) => a.actionTypeId);

    expect(remainingTypeIds).toContain("0-5");
    expect(remainingTypeIds).toContain("0-8");
    expect(remainingTypeIds).not.toContain("0-9");
    expect(remainingTypeIds).not.toContain("0-11");
  });

  it("generates stripped action entries for each removed action", () => {
    const result = preStripBrokenActions(basePayload, "Test Workflow");
    expect(result.strippedActions).toHaveLength(2);
    expect(result.strippedActions.map((a) => a.actionTypeId).sort()).toEqual(["0-11", "0-9"]);
  });

  it("generates manual steps for each stripped action", () => {
    const result = preStripBrokenActions(basePayload, "Test Workflow");
    expect(result.manualSteps).toHaveLength(2);
    expect(result.manualSteps.every((s) => s.priority === "required")).toBe(true);
  });

  it("re-links action chain around stripped actions", () => {
    const result = preStripBrokenActions(basePayload, "Test Workflow");
    const actions = result.payload.actions as Array<Record<string, unknown>>;

    // Action 1 (0-5) should now point to action 3 (0-8), since 2 (0-9) was stripped
    const action1 = actions.find((a) => a.actionId === "1");
    expect((action1?.connection as { nextActionId?: string })?.nextActionId).toBe("3");
  });

  it("does not strip working actions", () => {
    const cleanPayload = {
      ...basePayload,
      actions: [
        { actionId: "1", actionTypeId: "0-5", connection: { nextActionId: "2" } },
        { actionId: "2", actionTypeId: "0-8", connection: {} },
      ],
    };
    const result = preStripBrokenActions(cleanPayload, "Clean Workflow");
    expect(result.strippedActions).toHaveLength(0);
    expect(result.manualSteps).toHaveLength(0);
    expect(result.payload).toBe(cleanPayload); // Same reference, no changes
  });

  it("recalculates nextAvailableActionId after stripping", () => {
    const result = preStripBrokenActions(basePayload, "Test Workflow");
    const remaining = result.payload.actions as Array<Record<string, unknown>>;
    const maxId = Math.max(...remaining.map((a) => Number(a.actionId)));
    expect(result.payload.nextAvailableActionId).toBe(String(maxId + 1));
  });
});
