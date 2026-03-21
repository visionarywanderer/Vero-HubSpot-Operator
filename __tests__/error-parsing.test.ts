import { describe, it, expect } from "vitest";
import { parseHubSpotWorkflowError } from "@/lib/partial-install";

describe("parseHubSpotWorkflowError", () => {
  describe("extracts action type IDs from messages", () => {
    it("parses 'action type 0-11 is not available'", () => {
      const error = {
        message: "action type 0-11 is not available for this portal",
        statusCode: 400,
        category: "VALIDATION_ERROR",
      };
      const result = parseHubSpotWorkflowError(error);
      expect(result.problematicActionTypeIds.has("0-11")).toBe(true);
    });

    it("parses multiple action types in one message", () => {
      const error = {
        message: "action type 0-9 and action type 0-11 are not available",
        statusCode: 400,
        category: "VALIDATION_ERROR",
      };
      const result = parseHubSpotWorkflowError(error);
      expect(result.problematicActionTypeIds.has("0-9")).toBe(true);
      expect(result.problematicActionTypeIds.has("0-11")).toBe(true);
    });

    it("parses 'actionTypeId: 0-3'", () => {
      const error = {
        message: 'actionTypeId "0-3" is not supported',
        statusCode: 400,
        category: "VALIDATION_ERROR",
      };
      const result = parseHubSpotWorkflowError(error);
      expect(result.problematicActionTypeIds.has("0-3")).toBe(true);
    });
  });

  describe("extracts action indices from structured errors", () => {
    it("parses 'actions[2]' from error.in field", () => {
      const error = {
        message: "Validation failed",
        response: {
          data: {
            message: "Validation failed",
            errors: [
              { message: "Invalid action", in: "actions[2].actionTypeId", code: "INVALID" },
            ],
          },
        },
      };
      const result = parseHubSpotWorkflowError(error);
      expect(result.problematicActionIndices.has(2)).toBe(true);
    });
  });

  describe("does NOT match false positives", () => {
    it("does not match correlation IDs", () => {
      const error = {
        message: "Error occurred. Correlation ID: a1b2c3d4-1234-5678-abcd-ef0123456789",
        statusCode: 500,
        category: "SERVER_ERROR",
      };
      const result = parseHubSpotWorkflowError(error);
      // Correlation IDs like "1234-5678" should NOT be matched
      expect(result.problematicActionTypeIds.size).toBe(0);
    });

    it("does not match version numbers like v3-0", () => {
      const error = {
        message: "API v3-0 not supported",
        statusCode: 400,
        category: "VALIDATION_ERROR",
      };
      const result = parseHubSpotWorkflowError(error);
      // "3-0" preceded by "v" should NOT match
      expect(result.problematicActionTypeIds.has("3-0")).toBe(false);
    });
  });

  describe("handles edge cases", () => {
    it("handles null input", () => {
      const result = parseHubSpotWorkflowError(null);
      expect(result.problematicActionTypeIds.size).toBe(0);
      expect(result.rawMessage).toBe("Unknown error");
    });

    it("handles empty error object", () => {
      const result = parseHubSpotWorkflowError({});
      expect(result.problematicActionTypeIds.size).toBe(0);
    });

    it("handles error with no response data", () => {
      const result = parseHubSpotWorkflowError(new Error("Network error"));
      expect(result.rawMessage).toBe("Network error");
    });
  });

  describe("parses HubSpot context object", () => {
    it("extracts actionTypeId from context fields", () => {
      const error = {
        message: "Validation failed",
        statusCode: 400,
        category: "VALIDATION_ERROR",
        context: {
          actionTypeId: "0-15",
        },
      };
      const result = parseHubSpotWorkflowError(error);
      expect(result.problematicActionTypeIds.has("0-15")).toBe(true);
    });
  });
});
