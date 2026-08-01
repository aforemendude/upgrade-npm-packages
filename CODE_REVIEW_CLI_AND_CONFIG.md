# Code Review: CLI and Configuration

## Reviewed scope and basis

- Primary scope: `src/index.ts`, `src/cli.ts`, and `src/config.ts`.
- Contract context: `package.json`, `README.md`, and `CHANGELOG.md`; directly related production call sites in
  `src/process.ts`, `src/utils/npm.ts`, and `src/utils/logger.ts` were inspected only to verify behavior crossing the
  scoped files.
- Review basis: static tracing of CLI argument parsing, recursive discovery, entry-point behavior, process exit paths,
  and configuration consumers. The worktree was confirmed clean before review reports were created.

## Findings

### 1. A `package.json` symlink can redirect writes outside the scanned directory

- **Severity:** Medium
- **References:** `src/cli.ts:61-69`; `src/process.ts:112-121`; `README.md:3-7`
- **Problem:** Discovery excludes directory symlinks because they are not reported by `Dirent.isDirectory()`, but the
  fallback branch accepts every other directory entry whose name is `package.json` without requiring `entry.isFile()`. A
  symbolic link named `package.json` is therefore returned. The downstream `fs.readFile()` and `fs.writeFile()` calls
  follow that link without checking its resolved target.
- **Impact:** A repository can contain a `package.json` symlink whose target is outside the directory from which the
  user invoked the CLI. Running the documented command then rewrites that external manifest, violating the advertised
  “below the current working directory” boundary and potentially corrupting an unrelated project.
- **Recommendation:** Skip or explicitly reject symbolic-link manifests during discovery (for example, require
  `entry.isFile()`). If symlink support is intentional, resolve each target and enforce that it remains beneath the
  canonical starting directory immediately before writing, with protection against link-target changes.

### 2. Finding no manifests is logged as an error but exits successfully

- **Severity:** Low
- **References:** `src/cli.ts:91-94`; `src/cli.ts:115-127`
- **Problem:** When discovery returns no manifests, `run()` emits an error message and returns normally. Because
  `runCli()` assigns a failure exit status only inside its exception handler, the executable finishes with status 0 on
  this error path.
- **Impact:** Shell scripts and CI jobs cannot distinguish a successful upgrade from invoking the command in the wrong
  or empty directory. They can continue under the false assumption that dependencies were inspected and upgraded even
  though the CLI explicitly reported an error.
- **Recommendation:** Propagate this condition as an operational failure (for example, throw a dedicated error or return
  an explicit nonzero status that `runCli()` applies) so the command exits nonzero while retaining the current
  diagnostic.

### 3. Help advertises a command name that the package does not install

- **Severity:** Low
- **References:** `src/cli.ts:3`, `src/cli.ts:28-35`; `package.json:3-5`; `README.md:24-28`
- **Problem:** `getHelpMessage()` constructs its usage line from the package `name`, producing
  `Usage: @aforemendude/upgrade-npm-packages [options]`. The published binary and documented command are both named
  `upgrade-npm-packages`; npm does not install a binary under the scoped package identifier.
- **Impact:** Users who copy the command name from `--help` receive a command-not-found error even though they installed
  the CLI correctly. The same misleading usage is printed while explaining invalid arguments.
- **Recommendation:** Generate the usage line from the public binary name (preferably a single shared CLI-name constant
  that stays aligned with the `bin` key), not the npm package name.

## Unresolved questions

- None.

## Checks and areas not covered

- `node_modules/.bin/tsc --noEmit --pretty false` completed successfully on Node.js `v24.18.0`.
- `node_modules/.bin/vitest run src/cli.test.ts --reporter=dot` completed successfully (1 file, 7 tests).
- A focused `--help` invocation of the existing build confirmed that the rendered usage line contains the scoped package
  name while the published command is unscoped.
- A focused invocation against the known-empty `.git/branches` directory printed `ERROR: No package.json files found.`,
  resolved normally, and exited with status 0.
- Symlink discovery was verified by tracing the `Dirent` branches through the downstream read/write call site; no
  generated files were changed.
- A final scoped `git diff --exit-code` confirmed that none of the reviewed source, documentation, manifest, or
  configuration files were modified; only this report was created.
- Generated `dist` output and third-party dependencies were not reviewed.
- Individual tests, fixtures, assertions, and coverage adequacy were not reviewed, per the review scope and skill
  guardrails.
- No live registry queries, installs, dependency updates, or full test-suite runs were performed.
