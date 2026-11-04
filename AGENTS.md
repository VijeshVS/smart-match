## GitHub Workflow

Applies when the user asks to push code to GitHub.

- Never push directly to `main`, even when explicitly asked.
- Create a descriptive feature/fix branch for the finalized changes.
- Fetch the latest `main` and confirm the branch is conflict-free before opening a PR.
- Commit using Conventional Commits: `<type>(<scope>): <description>`, e.g. `feat(backend): add user authentication`, `fix(frontend): resolve login validation issue`, `docs(redis): document cache TTLs`.
- Push the branch, then open a PR into `main`.
- PR title must be `release(<scope>): <description>` with a free-form scope (`backend`, `sdk`, `ci`, `visual`, …).
- PR body must not be empty. Both are enforced by the `PR Hygiene` workflow.
