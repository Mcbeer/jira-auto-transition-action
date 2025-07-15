import core from "@actions/core";
import github from "@actions/github";
import axios from "axios";

export async function run() {
  try {
    // Get inputs
    const jiraBaseUrl = core.getInput("jira-base-url", { required: true });
    const jiraEmail = core.getInput("jira-email", { required: true });
    const jiraApiToken = core.getInput("jira-api-token", { required: true });
    const inProgressTransitionId = core.getInput("in-progress-transition-id", {
      required: true,
    });
    const underReviewTransitionId = core.getInput(
      "under-review-transition-id",
      { required: true }
    );
    const doneTransitionId = core.getInput("done-transition-id", {
      required: true,
    });
    const ticketPattern = core.getInput("ticket-pattern") || "[A-Z]+-[0-9]+";

    // Extract ticket number
    const ticketNumber = extractTicketNumber(ticketPattern);
    if (!ticketNumber) {
      core.info("No Jira ticket found in branch name");
      return;
    }

    // Determine transition
    const transition = determineTransition(
      inProgressTransitionId,
      underReviewTransitionId,
      doneTransitionId
    );
    if (!transition) {
      core.info("No transition needed for this event");
      return;
    }

    // Update Jira ticket
    await updateJiraTicket(
      jiraBaseUrl,
      jiraEmail,
      jiraApiToken,
      ticketNumber,
      transition
    );

    core.info(
      `✅ Successfully transitioned ${ticketNumber} to ${transition.status}`
    );
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

export function extractTicketNumber(pattern) {
  const { context } = github;
  let branchName = "";

  if (context.eventName === "create" && context.payload.ref_type === "branch") {
    branchName = context.payload.ref;
  } else if (context.eventName === "pull_request") {
    branchName = context.payload.pull_request.head.ref;
  }

  if (!branchName) return null;

  const regex = new RegExp(pattern);
  const match = branchName.match(regex);
  return match ? match[0] : null;
}

export function determineTransition(inProgressId, underReviewId, doneId) {
  const { context } = github;

  if (context.eventName === "create" && context.payload.ref_type === "branch") {
    return { id: inProgressId, status: "In Progress" };
  }

  if (context.eventName === "pull_request") {
    const { action, pull_request } = context.payload;

    if (
      (action === "opened" || action === "ready_for_review") &&
      !pull_request.draft
    ) {
      return { id: underReviewId, status: "Under Review" };
    }

    if (action === "closed" && pull_request.merged) {
      return { id: doneId, status: "Done" };
    }
  }

  return null;
}

export async function updateJiraTicket(
  baseUrl,
  email,
  apiToken,
  ticketNumber,
  transition
) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const response = await axios.post(
    `${baseUrl}/rest/api/3/issue/${ticketNumber}/transitions`,
    {
      transition: { id: transition.id },
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (response.status !== 204) {
    throw new Error(`Jira API returned status ${response.status}`);
  }
}

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

// Also run if this is the main module (for bundled environments)
if (typeof require !== "undefined" && require.main === module) {
  run();
}
