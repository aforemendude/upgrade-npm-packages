# Code Review: Upgrade Engine

## Reviewed scope and basis

- Primary scope: `src/package-json/dependency-reference.ts`, `src/package-json/upgrade-dependency-section.ts`,
  `src/package-json/upgrade-package-json.ts`, the production modules in `src/npm/`, and the production modules in
  `src/reinstall/`.
- Contract context inspected only as needed: `src/cli/run-upgrade-command.ts`,
  `src/config/dependency-upgrade-policy.ts`, `src/utils/find-file-system-entries.ts`, `src/utils/stringify-json.ts`,
  `src/index.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`, and `CHANGELOG.md`.
- Review basis: static tracing of dependency-reference classification, version selection, npm subprocesses, manifest
  writes, recursive cleanup, and directly related CLI call paths. Third-party source, generated output, and individual
  test cases/assertions were out of scope.
- The worktree was clean before review reports were created, as required by the invoked review workflow.

## Findings

### 5. Manifest replacement is non-atomic and can leave truncated JSON on write failure

- **Severity:** Medium
- **References:** `src/package-json/upgrade-package-json.ts:12-26`
- **Problem:** After all dependency lookups, `upgradePackageJson` writes directly over the existing manifest with
  `fs.writeFile`. Opening an existing file for this operation truncates it before the replacement is durably complete.
  If the process is interrupted or the write fails after truncation (for example, due to an I/O or out-of-space error),
  the catch block only logs and rethrows; it cannot restore the original content.
- **Impact:** A failed upgrade can leave the project's primary `package.json` empty or partially written, turning a
  recoverable lookup/write failure into manifest corruption and blocking npm and project tooling until the file is
  restored externally.
- **Recommendation:** Write the complete serialized manifest to a uniquely named temporary file in the same directory,
  preserve the original mode as appropriate, and atomically rename the temporary file over the destination only after a
  successful close. Clean up the temporary file on failure while leaving the original untouched.

## Checks and areas not covered

- `./node_modules/.bin/tsc --noEmit` completed successfully.
- `./node_modules/.bin/vitest run src/package-json src/npm src/reinstall` completed successfully: 12 test files and 86
  tests passed. The test cases, fixtures, logic, assertions, and coverage adequacy were not reviewed.
- A focused SemVer probe using the installed `semver` dependency confirmed that `<9` and `<=8` both have minimum `0.0.0`
  (major 0), while `>=8 <9` and `^8` have minimum major 8.
- No live-registry end-to-end lookup was run; registry state, authentication, proxy behavior, and custom npm
  configuration were not evaluated.
- The destructive `--force-reinstall` path was not executed against real projects. Windows/junction behavior, permission
  failures, interrupted writes, out-of-space faults, and process-signal timing were not fault-injected.
- Third-party dependency source and generated output were not reviewed.
