import { describe, it, expect } from "vitest";
import { isActionTypeError } from "@/lib/partial-install";

// Simulate HubSpotApiError structure (we can't import the class directly without
// initializing the full API client, so we create matching objects)
function makeHubSpotError(statusCode: number, message: string, category = "UNKNOWN_ERROR") {
  const err = new Error(message) as Error & {
    statusCode: number;
    category: string;
    correlationId: string;
  };
  err.statusCode = statusCode;
  err.category = category;
  err.correlationId = "test-correlation-id";
  return err;
}

describe("isActionTypeError", () => {
  describe("should return false for non-action-type errors", () => {
    it("rejects 401 auth errors", () => {
      const err = makeHubSpotError(401, "Unauthorized");
      expect(isActionTypeError(err)).toBe(false);
    });

    it("rejects 403 permission errors", () => {
      const err = makeHubSpotError(403, "Missing required scope: automation");
      expect(isActionTypeError(err)).toBe(false);
    });

    it("rejects 429 rate limit errors", () => {
      const err = makeHubSpotError(429, "Rate limit exceeded");
      expect(isActionTypeError(err)).toBe(false);
    });

    it("rejects 404 not found errors", () => {
      const err = makeHubSpotError(404, "Endpoint not found");
      expect(isActionTypeError(err)).toBe(false);
    });

    it("rejects structural validation errors (required field)", () => {
      const err = makeHubSpotError(400, "Required field 'name' is missing");
      expect(isActionTypeError(err)).toBe(false);
    });

    it("rejects enrollment criteria errors", () => {
      const err = makeHubSpotError(400, "Invalid enrollment filter configuration");
      expect(isActionTypeError(err)).toBe(false);
    });
  });

  describe("should return true for action-type errors", () => {
    it("matches 'action type 0-11 is not available'", () => {
      const err = makeHubSpotError(400, "action type 0-11 is not available for this portal");
      expect(isActionTypeError(err)).toBe(true);
    });

    it("matches 'actionTypeId 0-9 not supported'", () => {
      const err = makeHubSpotError(400, "actionTypeId 0-9 is not supported");
      expect(isActionTypeError(err)).toBe(true);
    });

    it("matches 'unsupported action'", () => {
      const err = makeHubSpotError(400, "unsupported action in workflow spec");
      expect(isActionTypeError(err)).toBe(true);
    });

    it("matches 400 errors with 'not available' pattern", () => {
      const err = makeHubSpotError(400, "Action 0-11 not available on this portal");
      expect(isActionTypeError(err)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles null/undefined gracefully", () => {
      expect(isActionTypeError(null)).toBe(false);
      expect(isActionTypeError(undefined)).toBe(false);
    });

    it("handles plain string errors", () => {
      expect(isActionTypeError("action type 0-11 not available")).toBe(true);
    });

    it("handles plain Error objects", () => {
      const err = new Error("Something broke");
      expect(isActionTypeError(err)).toBe(false);
    });
  });
});
