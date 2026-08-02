# Upgrade NPM Packages

A CLI that recursively finds regular `package.json` files below the current working directory, updates their
`dependencies` and `devDependencies`, and optionally performs a clean reinstall from the current working directory.

The command treats every discovered `package.json` independently. It skips `node_modules` directories and symbolic-link
manifests, but otherwise walks all subdirectories from the directory where the command is run.

## Requirements

- Node.js 20 or newer
- npm

## Installation

Install the published CLI globally from npm:

```bash
npm install --global @aforemendude/upgrade-npm-packages
```

## Usage

Run the command from the directory you want to scan:

```bash
upgrade-npm-packages
```

By default, the CLI only updates discovered `package.json` files. It does not delete lockfiles, delete `node_modules`,
or run `npm install`.

To force a clean reinstall after all `package.json` files are updated:

```bash
upgrade-npm-packages --force-reinstall
```

For each `package.json` file it finds, the tool:

1. Reads `dependencies` and `devDependencies`.
2. Looks up package versions with `npm view <package> versions time --json`.
3. Checks eligible candidate versions with `npm view <package>@<version> deprecated --json` until it finds a
   non-deprecated version.
4. Replaces each eligible dependency reference with an exact version string.
5. Writes the `package.json` with two-space formatting and alphabetically sorted object keys.

When `--force-reinstall` is present, the tool then deletes every discovered `package-lock.json` file and `node_modules`
directory below the current working directory, and runs `npm install` once in the current working directory. It does
this once regardless of how many `package.json` files were found.

## Version Selection

- Deprecated candidate versions are excluded from selection. Candidates are checked newest first after age, range,
  prerelease, and same-major filters have been applied.
- Packages in the `@aforemendude` namespace have no minimum required package age. Other packages prefer the newest
  version that was published at least 7 days ago.
- Normal dependencies ignore prerelease versions. If the current dependency reference contains a prerelease version,
  prerelease versions are also eligible.
- If the current dependency reference contains a SemVer version newer than the latest eligible candidate, that current
  SemVer version is pinned instead of being downgraded. Versions below the current SemVer version are not checked for
  deprecation.
- If the current dependency reference does not contain a complete SemVer version but is a valid SemVer range, the
  selected version must satisfy that range. If no satisfying non-deprecated version is at least 7 days old, the earliest
  satisfying non-deprecated version is pinned.
- Dependency references set to `*` are skipped.
- Other dependency references are parsed by looking for a SemVer version inside the string. References that do not
  contain a SemVer version and are not valid SemVer ranges do not get downgrade or range protection.
- Version ranges are not preserved; selected versions are written as exact pins. For example, `^1.2.3` can become
  `2.0.0`.

The following packages are only upgraded within their current major version when the current reference contains or can
be interpreted as a SemVer major version:

- `@eslint/js`
- `@types/node`
- `eslint`

## Failure Behavior

- If no `package.json` files are found, the command logs an error and exits without changing files.
- If version lookup fails for a dependency, that dependency is skipped.
- If processing a `package.json` fails, the command stops and exits with an error.
- When `--force-reinstall` is present, cleanup or `npm install` failure stops the command and exits with an error.

## Project Structure

Production code is grouped by responsibility, and tests are colocated with the modules they cover:

```text
src/
├── cli/           argument parsing, help output, command orchestration, and process lifecycle
├── config/        dependency-upgrade policy
├── npm/           npm command execution, registry access, and version selection
├── package-json/  manifest discovery, dependency-reference parsing, and manifest upgrades
├── reinstall/     reinstall-target discovery, cleanup, and installation
├── utils/         shared filesystem, JSON, and logging utilities
└── index.ts       executable entry point
```

The recursive filesystem search is shared by package discovery and reinstall cleanup. npm output parsing and command
execution are likewise centralized so registry and installation modules do not duplicate subprocess handling.

## Development

```bash
# Compile TypeScript
npm run build

# Check formatting
npm run format:check

# Format code with Prettier
npm run format

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run formatting, build, and tests
npm run verify
```
