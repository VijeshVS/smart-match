## Before Starting Any Development

Applies before any development or implementation work, regardless of the request.

1. **Switch to `main` and pull the latest changes.**
   ```bash
   git checkout main
   git pull --ff-only origin main
   ```
2. **Create a new branch based on the scope of the given work.**
   - Choose a descriptive `feature` / `fix` / `docs` / `chore` name that reflects the task, e.g. `feat(candidate): add profile summary` or `fix(recruiter): correct credit deduction`.
   - Never start implementation on a stale branch or directly on `main`.
3. **Follow all the rules in the GitHub Workflow below** for commits, pushes, pull requests, and issue linking.

## GitHub Workflow

Applies when the user asks to push code to GitHub, and to all development work started under the section above.

- Never push directly to `main`, even when explicitly asked.
- Create a descriptive feature/fix branch for the finalized changes (from the latest `main`, per the section above).
- Fetch the latest `main` and confirm the branch is conflict-free before opening a PR.
- Commit using Conventional Commits: `<type>(<scope>): <description>`, e.g. `feat(backend): add user authentication`, `fix(frontend): resolve login validation issue`, `docs(redis): document cache TTLs`.
- Push the branch, then open a PR into `main`.
- PR title must be `release(<scope>): <description>` with a free-form scope (`backend`, `sdk`, `ci`, `visual`, …).
- PR body must not be empty. Both are enforced by the `PR Hygiene` workflow.
- Every PR that resolves an issue must include the issue number in the PR description with a closing keyword, e.g. `This PR will close #<issue-number>` (or `Closes #<issue-number>`), so GitHub automatically closes the issue when the PR is merged.

## GitHub Issue Resolution Workflow

Applies whenever the user provides a GitHub issue (URL, issue number, or reference) and asks to work on it.

1. **Gather full issue context before planning.**
   - Read the complete issue, including the title, body, labels, assignee, milestone, linked issues/PRs, and every comment: `gh issue view <number> --comments`.
   - Inspect referenced code, documentation, logs, and reproduction steps in the repository.
   - Do not begin implementation until the requirements, acceptance criteria, and current behaviour are understood.

2. **Devise and post a detailed plan in the issue.**
   - Comment on the issue with the implementation plan before making code changes: `gh issue comment <number> --body-file <plan-file>`.
   - Include: summary of the issue/root cause, proposed approach, files/modules to change, testing strategy, risks/edge cases, and how each acceptance criterion will be verified.
   - If the issue is ambiguous or blocked, state the open questions in the comment before proceeding.

3. **Implement the solution.**
   - Make focused changes that solve the issue, including tests and documentation where appropriate.
   - Verify the changes locally and keep unrelated modifications out of the branch.

4. **Follow the GitHub Workflow above to ship the fix.**
   - Create a descriptive branch from the latest `main`, commit with Conventional Commits, push it, and open a PR into `main`.
   - Reference the issue in the PR body using a closing keyword such as `This PR will close #<number>` or `Closes #<number>` so the issue closes automatically on merge, and include a non-empty summary and verification notes.

5. **Link the PR back to the issue.**
   - Comment on the issue with the PR URL and a short summary of the implemented change: `gh issue comment <number> --body "PR: <url>"`.

6. **Post the final implementation report on the issue.**
   - After the PR is up to date and verified, add a comment covering:
     - **Acceptance criteria:** list each criterion and whether it is satisfied, with evidence (tests, screenshots, commands, or PR links).
     - **Bugs/issues found during development:** unrelated defects, regressions, or blockers discovered while working, and their status.
     - **Extra work done:** refactors, cleanup, docs, tests, or other changes beyond the original scope, with justification.
     - **Assumptions made:** assumptions or interpretations made during implementation, why they were necessary, and the impact if any assumption is incorrect.
     - **Verification performed:** commands/tests run and their results.
     - **Known limitations or follow-up work:** anything intentionally deferred, plus recommended next steps.
     - **PR link:** the final PR URL.
   - Do not close the issue manually unless the user asks; let the linked PR close it on merge, or close it only after the fix is verified.
