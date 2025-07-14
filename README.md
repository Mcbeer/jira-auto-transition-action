## What

I often forget to move my Jira tickets, and they often fall behind, and other team members have to ask me for updates on a task.
This action will move your Jira ticket in 3 steps.

1.  When a branch, with the ticket name in the title, is created, the action should run, as it will move the ticket from your "Ready for development" column, to your "In progrss" column
2.  When a PR is created, with the ticket name in the title, it should again run the action. This time we move the ticket from your "In progress" to your "Under review" columns.
3.  When the PR, with the ticket name in the title, is merged to main, the action should run again, as this will now move the ticket into the "done" column.

## What not

If you create a PR, run the action, and then delete said PR, we take no actions.
It is meant to be a SIMPLE action, that will progress your task in one direction. We NEVER move your task "backwards" in the flow.

It is also NOT an excuse to not check up on tickets in Jira. Please keep your PM's safe, and look at the Jira board. They spend a lot of time making it for you.

## How to use:

```yaml
name: Jira Integration
on:
  create:
  pull_request:
    types: [opened, ready_for_review, closed]

jobs:
  jira-transition:
    runs-on: ubuntu-latest
    steps:
      - uses: mcbeer/jira-auto-transition-action@v1
        with:
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          in-progress-transition-id: "21"
          under-review-transition-id: "31"
          done-transition-id: "41"
```
