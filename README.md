# Upgrade NPM Packages

A CLI that recursively finds `package.json` files below the current working directory, updates their `dependencies` and
`devDependencies`, and refreshes each package's `package-lock.json`.

The command treats every discovered `package.json` independently. It skips `node_modules` directories, but otherwise
walks all subdirectories from the directory where the command is run.

## Requirements

- Node.js 18 or newer
- npm

## Installation

Clone the repository, install dependencies, build the project, and link the CLI:

```bash
npm install
npm run build
npm link
```

## Usage

Run the command from the directory you want to scan:

```bash
upgrade-npm-packages
```

The CLI does not currently accept arguments or options.

For each `package.json` file it finds, the tool:

1. Reads `dependencies` and `devDependencies`.
2. Looks up package versions with `npm view <package> versions time --json`.
3. Replaces each eligible dependency reference with an exact version string.
4. Writes the `package.json` with two-space formatting and alphabetically sorted object keys.
5. Deletes `package-lock.json` in the same directory, if it exists.
6. Runs `npm install` in that package directory to create a fresh lockfile.

## Version Selection

- The selected version must have been published at least 7 days ago.
- Normal dependencies ignore prerelease versions. If the current dependency reference contains a prerelease version,
  prerelease versions are also eligible.
- If the current dependency reference contains a SemVer version newer than the latest eligible version, the dependency
  is left unchanged instead of being downgraded.
- Dependency references set to `*` are skipped.
- Other dependency references are parsed by looking for a SemVer version inside the string. References without a SemVer
  version do not get downgrade protection.
- Version ranges are not preserved. For example, `^1.2.3` can become `2.0.0`.

The following packages are only upgraded within their current major version when the current reference contains a SemVer
major version:

- `@eslint/js`
- `@types/node`
- `eslint`

## Failure Behavior

- If no `package.json` files are found, the command logs an error and exits without changing files.
- If version lookup fails for a dependency, that dependency is skipped.
- If processing a `package.json` fails, or `npm install` fails, the command stops and exits with an error.

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
