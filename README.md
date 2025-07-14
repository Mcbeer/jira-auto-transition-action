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
      - uses: mcbeer/jira-transition-action@v1
        with:
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}
          jira-email: ${{ secrets.JIRA_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          in-progress-transition-id: "21"
          under-review-transition-id: "31"
          done-transition-id: "41"
```
