import { describe, it, expect } from "vitest";
import { validateWorkflowForDeploy } from "@/lib/constraint-validator";

describe("validateWorkflowForDeploy", () => {
  const validWorkflow = {
    name: "[VD] Test Workflow",
    type: "CONTACT_FLOW",
    objectTypeId: "0-1",
    isEnabled: false,
    startActionId: "1",
    nextAvailableActionId: "3",
    enrollmentCriteria: {
      type: "EVENT_BASED",
      filterBranch: {
        filterBranchType: "OR",
        filterBranches: [
          {
            filterBranchType: "AND",
            filters: [{ property: "email", filterType: "PROPERTY", operator: "IS_KNOWN" }],
          },
        ],
      },
    },
    actions: [
      { actionId: "1", actionTypeId: "0-5", connection: { nextActionId: "2" } },
      { actionId: "2", actionTypeId: "0-8", connection: {} },
    ],
  };

  it("passes for a valid workflow spec", () => {
    const errors = validateWorkflowForDeploy(validWorkflow);
    expect(errors).toHaveLength(0);
  });

  describe("required fields", () => {
    it("fails when name is missing", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, name: undefined });
      expect(errors.some((e) => e.field === "name")).toBe(true);
    });

    it("fails when type is missing", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, type: undefined });
      expect(errors.some((e) => e.field === "type")).toBe(true);
    });

    it("fails when objectTypeId is missing", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, objectTypeId: undefined });
      expect(errors.some((e) => e.field === "objectTypeId")).toBe(true);
    });

    it("fails when startActionId is missing", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, startActionId: undefined });
      expect(errors.some((e) => e.field === "startActionId")).toBe(true);
    });

    it("fails when actions is empty", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, actions: [] });
      expect(errors.some((e) => e.field === "actions")).toBe(true);
    });

    it("fails when enrollmentCriteria is missing", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, enrollmentCriteria: undefined });
      expect(errors.some((e) => e.field === "enrollmentCriteria")).toBe(true);
    });
  });

  describe("safety checks", () => {
    it("fails when isEnabled is true", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, isEnabled: true });
      expect(errors.some((e) => e.field === "isEnabled")).toBe(true);
    });

    it("fails when isEnabled is not set", () => {
      const { isEnabled: _, ...noEnabled } = validWorkflow;
      const errors = validateWorkflowForDeploy(noEnabled);
      expect(errors.some((e) => e.field === "isEnabled")).toBe(true);
    });
  });

  describe("action chain integrity", () => {
    it("fails when startActionId references non-existent action", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, startActionId: "99" });
      expect(errors.some((e) => e.field === "startActionId")).toBe(true);
    });

    it("fails when nextActionId references non-existent action", () => {
      const badActions = [
        { actionId: "1", actionTypeId: "0-5", connection: { nextActionId: "99" } },
        { actionId: "2", actionTypeId: "0-8", connection: {} },
      ];
      const errors = validateWorkflowForDeploy({ ...validWorkflow, actions: badActions });
      expect(errors.some((e) => e.field.includes("nextActionId"))).toBe(true);
    });
  });

  describe("nextAvailableActionId validation", () => {
    it("fails when nextAvailableActionId is wrong", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, nextAvailableActionId: "10" });
      expect(errors.some((e) => e.field === "nextAvailableActionId")).toBe(true);
    });

    it("accepts string nextAvailableActionId", () => {
      const errors = validateWorkflowForDeploy({ ...validWorkflow, nextAvailableActionId: "3" });
      expect(errors.filter((e) => e.field === "nextAvailableActionId")).toHaveLength(0);
    });
  });

  describe("type-objectTypeId consistency", () => {
    it("fails when contacts use PLATFORM_FLOW", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        objectTypeId: "0-1",
        type: "PLATFORM_FLOW",
      });
      expect(errors.some((e) => e.message.includes("CONTACT_FLOW"))).toBe(true);
    });

    it("fails when deals use CONTACT_FLOW", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        objectTypeId: "0-3",
        type: "CONTACT_FLOW",
      });
      expect(errors.some((e) => e.message.includes("PLATFORM_FLOW"))).toBe(true);
    });
  });

  describe("enrollment criteria validation", () => {
    it("fails when enrollment criteria has no type", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        enrollmentCriteria: { filterBranch: {} },
      });
      expect(errors.some((e) => e.field.includes("enrollmentCriteria.type"))).toBe(true);
    });

    it("fails when filterBranch has no filterBranchType", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        enrollmentCriteria: {
          type: "EVENT_BASED",
          filterBranch: {
            filters: [],
          },
        },
      });
      expect(errors.some((e) => e.field.includes("filterBranchType"))).toBe(true);
    });

    it("fails when filterBranchOperator is invalid", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        enrollmentCriteria: {
          type: "EVENT_BASED",
          filterBranch: {
            filterBranchType: "OR",
            filterBranchOperator: "NAND",
          },
        },
      });
      expect(errors.some((e) => e.field.includes("filterBranchOperator"))).toBe(true);
    });

    it("fails when enrollment type is invalid", () => {
      const errors = validateWorkflowForDeploy({
        ...validWorkflow,
        enrollmentCriteria: {
          type: "STATIC_LIST",
          filterBranch: { filterBranchType: "OR" },
        },
      });
      expect(errors.some((e) => e.field.includes("enrollmentCriteria.type"))).toBe(true);
    });
  });
});
