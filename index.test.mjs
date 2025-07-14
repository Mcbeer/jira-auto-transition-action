import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock the modules first with factory functions
vi.mock("@actions/core", () => ({
  default: {
    getInput: vi.fn(),
    info: vi.fn(),
    setFailed: vi.fn(),
  },
}));

vi.mock("@actions/github", () => ({
  default: {
    context: {
      eventName: "",
      payload: {},
    },
  },
}));

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Now import the modules after mocking
import core from "@actions/core";
import github from "@actions/github";
import axios from "axios";
import {
  extractTicketNumber,
  determineTransition,
  updateJiraTicket,
  run,
} from "./index.mjs";

describe("extractTicketNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should extract ticket from branch name on branch creation", () => {
    github.context = {
      eventName: "create",
      payload: {
        ref_type: "branch",
        ref: "feature/PROJ-123-add-new-feature",
      },
    };

    const result = extractTicketNumber("[A-Z]+-[0-9]+");
    expect(result).toBe("PROJ-123");
  });

  test("should extract ticket from PR head branch", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        pull_request: {
          head: {
            ref: "bugfix/ABC-456-fix-critical-bug",
          },
        },
      },
    };

    const result = extractTicketNumber("[A-Z]+-[0-9]+");
    expect(result).toBe("ABC-456");
  });

  test("should return null when no ticket found", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        pull_request: {
          head: {
            ref: "feature/no-ticket-here",
          },
        },
      },
    };

    const result = extractTicketNumber("[A-Z]+-[0-9]+");
    expect(result).toBe(null);
  });

  test("should return null when no branch name available", () => {
    github.context = {
      eventName: "push",
      payload: {},
    };

    const result = extractTicketNumber("[A-Z]+-[0-9]+");
    expect(result).toBe(null);
  });

  test("should work with custom ticket pattern", () => {
    github.context = {
      eventName: "create",
      payload: {
        ref_type: "branch",
        ref: "feature/CUSTOM123-add-feature",
      },
    };

    const result = extractTicketNumber("CUSTOM[0-9]+-[a-z-]+");
    expect(result).toBe("CUSTOM123-add-feature");
  });
});

describe("determineTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return In Progress transition for branch creation", () => {
    github.context = {
      eventName: "create",
      payload: {
        ref_type: "branch",
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toEqual({ id: "1", status: "In Progress" });
  });

  test("should return Under Review transition for opened PR", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          draft: false,
        },
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toEqual({ id: "2", status: "Under Review" });
  });

  test("should return Under Review transition for ready_for_review PR", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "ready_for_review",
        pull_request: {
          draft: false,
        },
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toEqual({ id: "2", status: "Under Review" });
  });

  test("should return null for draft PR opened", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          draft: true,
        },
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toBe(null);
  });

  test("should return Done transition for merged PR", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "closed",
        pull_request: {
          merged: true,
        },
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toEqual({ id: "3", status: "Done" });
  });

  test("should return null for closed but not merged PR", () => {
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "closed",
        pull_request: {
          merged: false,
        },
      },
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toBe(null);
  });

  test("should return null for unsupported events", () => {
    github.context = {
      eventName: "push",
      payload: {},
    };

    const result = determineTransition("1", "2", "3");
    expect(result).toBe(null);
  });
});

describe("updateJiraTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should make correct API call to Jira", async () => {
    axios.post.mockResolvedValue({ status: 204 });

    await updateJiraTicket(
      "https://company.atlassian.net",
      "test@example.com",
      "api-token",
      "PROJ-123",
      { id: "2", status: "Under Review" }
    );

    expect(axios.post).toHaveBeenCalledWith(
      "https://company.atlassian.net/rest/api/3/issue/PROJ-123/transitions",
      {
        transition: { id: "2" },
      },
      {
        headers: {
          Authorization: expect.stringMatching(/^Basic /),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
  });

  test("should encode credentials correctly", async () => {
    axios.post.mockResolvedValue({ status: 204 });

    await updateJiraTicket(
      "https://company.atlassian.net",
      "test@example.com",
      "api-token",
      "PROJ-123",
      { id: "2", status: "Under Review" }
    );

    const call = axios.post.mock.calls[0];
    const authHeader = call[2].headers.Authorization;
    const expectedAuth = Buffer.from("test@example.com:api-token").toString(
      "base64"
    );
    expect(authHeader).toBe(`Basic ${expectedAuth}`);
  });

  test("should throw error for non-204 response", async () => {
    axios.post.mockResolvedValue({ status: 400 });

    await expect(
      updateJiraTicket(
        "https://company.atlassian.net",
        "test@example.com",
        "api-token",
        "PROJ-123",
        { id: "2", status: "Under Review" }
      )
    ).rejects.toThrow("Jira API returned status 400");
  });

  test("should propagate axios errors", async () => {
    axios.post.mockRejectedValue(new Error("Network error"));

    await expect(
      updateJiraTicket(
        "https://company.atlassian.net",
        "test@example.com",
        "api-token",
        "PROJ-123",
        { id: "2", status: "Under Review" }
      )
    ).rejects.toThrow("Network error");
  });
});

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset github context
    github.context = {
      eventName: "",
      payload: {},
    };
  });

  test("should complete successfully with valid inputs", async () => {
    // Mock inputs
    core.getInput.mockImplementation((name) => {
      const inputs = {
        "jira-base-url": "https://company.atlassian.net",
        "jira-email": "test@example.com",
        "jira-api-token": "api-token",
        "in-progress-transition-id": "1",
        "under-review-transition-id": "2",
        "done-transition-id": "3",
        "ticket-pattern": "[A-Z]+-[0-9]+",
      };
      return inputs[name];
    });

    // Mock github context for branch creation
    github.context = {
      eventName: "create",
      payload: {
        ref_type: "branch",
        ref: "feature/PROJ-123-new-feature",
      },
    };

    // Mock successful Jira API call
    axios.post.mockResolvedValue({ status: 204 });

    await run();

    expect(core.info).toHaveBeenCalledWith(
      "✅ Successfully transitioned PROJ-123 to In Progress"
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  test("should handle no ticket found gracefully", async () => {
    core.getInput.mockImplementation((name) => {
      const inputs = {
        "jira-base-url": "https://company.atlassian.net",
        "jira-email": "test@example.com",
        "jira-api-token": "api-token",
        "in-progress-transition-id": "1",
        "under-review-transition-id": "2",
        "done-transition-id": "3",
        "ticket-pattern": "[A-Z]+-[0-9]+",
      };
      return inputs[name];
    });

    github.context = {
      eventName: "create",
      payload: {
        ref_type: "branch",
        ref: "feature/no-ticket-here",
      },
    };

    await run();

    expect(core.info).toHaveBeenCalledWith(
      "No Jira ticket found in branch name"
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  test("should handle no transition needed gracefully", async () => {
    core.getInput.mockImplementation((name) => {
      const inputs = {
        "jira-base-url": "https://company.atlassian.net",
        "jira-email": "test@example.com",
        "jira-api-token": "api-token",
        "in-progress-transition-id": "1",
        "under-review-transition-id": "2",
        "done-transition-id": "3",
        "ticket-pattern": "[A-Z]+-[0-9]+",
      };
      return inputs[name];
    });

    // Use a scenario with a valid ticket but a draft PR (no transition needed)
    github.context = {
      eventName: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          draft: true,
          head: {
            ref: "feature/PROJ-123-new-feature",
          },
        },
      },
    };

    await run();

    expect(core.info).toHaveBeenCalledWith(
      "No transition needed for this event"
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  test("should handle errors and call setFailed", async () => {
    core.getInput.mockImplementation((name) => {
      if (name === "jira-base-url") {
        throw new Error("Missing required input");
      }
      return "";
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "Action failed: Missing required input"
    );
  });
});
