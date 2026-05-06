# Contributing

Thanks for your interest in `@acegalaxy/security-utils`! Issues and PRs are welcome.

## Reporting issues

- Search [existing issues](https://github.com/acegalaxy-co/ace_commons-security-utils-nodejs/issues) first.
- For bugs, use the **Bug report** template (steps to reproduce, expected vs actual, env).
- For features, use the **Feature request** template.
- For **security vulnerabilities**, do **not** open a public issue — see [SECURITY.md](./SECURITY.md).

## Pull request process

1. **Fork** the repo and create a branch off `dev`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make your change. Keep diffs focused — one concern per PR.
3. **Add or update tests** under `test/`. Run:
   ```bash
   npm test
   ```
4. **Sign off** your commits (DCO):
   ```bash
   git commit -s -m "feat(audit-log): add foo"
   ```
5. Open a PR against `dev`. Fill out the PR template checklist.
6. A maintainer will review within a few business days.

## Code style

- **TypeScript strict mode** (`strict: true`).
- **Prettier defaults** (no custom config) — run `npx prettier --write .` before committing.
- No new heavy runtime deps without discussion.
- Prefer pure functions; side effects isolated and documented.

## Commit convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

Signed-off-by: Your Name <you@example.com>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

## Code of conduct

This project follows the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md). By participating you agree to abide by it.
