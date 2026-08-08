# Code Review: Utilities and Tooling

## Scope and review basis

- **Reviewed scope:** `src/utils/stringify-json.ts`, `src/utils/logger.ts`, `package.json`, `package-lock.json`,
  `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.prettierrc.json`, `.vscode/settings.json`, and repository setup,
  build, packaging, dependency, and test infrastructure.
- **Contract-validation context inspected:** `src/index.ts`, the production modules in `src/cli/`,
  `src/package-json/upgrade-dependency-section.ts`, `src/package-json/upgrade-package-json.ts`, the production modules
  in `src/npm/`, `README.md`, and `CHANGELOG.md`. These files were used only to trace callers, entry-point behavior,
  documented requirements, and packaging contracts.
- **Review basis:** current worktree at commit `fe9db76723e8df59079d94c3b880df862326d239` (2026-08-01). The whole
  repository was confirmed clean before review reports were created. Generated output, third-party source, and
  individual test cases, fixtures, logic, and assertions were out of scope.
- **Status:** complete.

## Findings

### UTL-005 — The build and prepack workflows are not portable to Windows

- **Severity:** Medium
- **Location:** `package.json:47-55`
- **Problem:** The build script directly invokes the POSIX commands `rm -rf` and `chmod`. npm uses `cmd.exe` for scripts
  on standard Windows installations, where those commands are unavailable. Because `prepack` reaches `build`, the same
  platform assumption affects both local compilation and package creation.
- **Impact:** Windows contributors cannot use the documented `npm run build`, `npm run verify`, or normal pack/publish
  workflows without adding a Unix compatibility shell, despite the project otherwise being a cross-platform Node.js CLI
  and documenting no operating-system restriction.
- **Recommendation:** Move cleanup and executable-mode handling into a small cross-platform Node.js build script (using
  `fs.rm`/`fs.chmod` as appropriate), or use maintained cross-platform tooling. Preserve the shebang and verify the
  packaged `bin` mode on supported release platforms.

### UTL-006 — Logger color escapes cannot be disabled and leak into redirected output

- **Severity:** Low
- **Location:** `src/utils/logger.ts:1-25`
- **Problem:** Every log prefix contains hard-coded ANSI color and reset sequences, regardless of whether its
  destination stream is an interactive terminal or color output has been disabled. A redirected `logger.info()` probe
  confirmed that stdout begins with the raw bytes for `ESC[34m`; the same pattern is used for warning and error output.
- **Impact:** Redirected logs, CI artifacts, and output consumed by another process contain control characters, making
  them harder to search, parse, compare, or display in environments that do not interpret ANSI escapes.
- **Recommendation:** Apply colors only when the relevant stream (`stdout` for info/success and `stderr` for warn/error)
  supports them, and provide a conventional environment or explicit option to disable color. Emit plain prefixes in all
  other cases.

## Reviewed segments without additional findings

- No additional finding was verified in `src/utils/stringify-json.ts` beyond UTL-001. This statement does not imply the
  utility is defect-free.
- No additional finding was verified in `src/utils/logger.ts` beyond UTL-006. This statement does not imply the logger
  is defect-free.
- No additional findings were verified in `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.prettierrc.json`, or
  `.vscode/settings.json`. This statement does not imply those files are defect-free.
- No additional manifest/lockfile dependency inconsistency was verified beyond UTL-003 and UTL-004; the root name,
  version, direct dependencies, development dependencies, engine declaration, and bin mapping agree between
  `package.json` and `package-lock.json`.

## Unresolved questions

- Is this package intentionally CLI-only, or is a supported programmatic API intended? That choice determines whether
  UTL-002 should be resolved by removing `main` or by adding a separate import-safe entry point.
- Which Node.js versions and host operating systems are intended to be supported separately for published CLI runtime
  use and for contributor/release workflows? No repository automation or version-manager declaration resolves the
  conflicting contracts described in UTL-003 and UTL-005.

## Material checks and areas not covered

- `git status --short` was empty before report creation. A final scoped `git diff` confirmed that none of the reviewed
  source, manifest, lockfile, or configuration files changed during review; only review reports were untracked.
- `npm ls --all` and `npm ls --omit=dev --all` completed successfully against the existing installation. Optional
  platform-specific packages reported by npm were not treated as missing required dependencies.
- `npm run build` completed successfully under Node.js 24.18.0 and npm 11.16.0. It created the ignored generated `dist/`
  tree; the primary reviewer subsequently removed that generated tree and restored the initial workspace state. This
  check does not validate the declared Node.js minimum or Windows behavior.
- `npm run format:check` completed successfully. Formatting itself, including whitespace and line-terminator concerns,
  was excluded by the review skill.
- The default `npm pack --dry-run --json` probe invoked `prepack`, which invoked `verify`, including the declared
  `npm install`; formatting, build, and 47 tests across five test files then passed. The pack command ultimately failed
  with `EROFS` when npm tried to write its cache under `/home/user/.npm`, outside the writable workspace. A subsequent
  `npm pack --dry-run --json --ignore-scripts` using a temporary writable cache succeeded and listed a nine-file
  package; generated test modules were excluded and `dist/index.js` had executable mode. The install step made no
  tracked change to `package.json`, `package-lock.json`, or any other reviewed file. No further install/update command
  was run.
- A focused serializer probe confirmed that a conditional map inserted as `node`, `import`, `default` is emitted as
  `default`, `import`, `node`, matching the transformation described in UTL-001.
- Requiring the built `main` entry from an isolated empty temporary directory immediately printed the CLI banner and
  began scanning that directory, confirming UTL-002 without exposing a manifest to modification.
- A redirected logger probe inspected raw stdout bytes and confirmed the leading ANSI escape described in UTL-006.
- Individual test cases, fixtures, logic, assertions, and coverage adequacy were not reviewed. The test suite was run
  only as an infrastructure/build signal.
- The primary reviewer ran `npm audit --json` against the existing full dependency tree; npm reported zero known
  vulnerabilities. Unsupported-Node execution, Windows execution, performance/load testing, and publication were not
  performed. Third-party dependency source and generated JavaScript were out of scope.
- No CI configuration was present in the repository, so hosted automation, OS/version matrices, and release credentials
  could not be reviewed.
