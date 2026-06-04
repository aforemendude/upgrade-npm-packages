# Upgrade NPM Packages

A tool to recursively search for `package.json` files and upgrade all packages to the latest versions that are at least
7 days old. It also automatically refreshes the lockfile by deleting `package-lock.json` and running `npm install`.

## Installation

To use this tool globally, clone the repository, install its dependencies, build the project, and register the global
command via `npm link`:

```bash
npm install
npm run build
npm link
```

## Usage

After linking, the `upgrade-npm-packages` command will be available globally. You can run it from any directory:

```bash
upgrade-npm-packages
```

The tool will search for `package.json` files in the current directory and all subdirectories (excluding
`node_modules`). For each `package.json` found, it will:

1. Upgrade `dependencies` and `devDependencies` to the latest versions that are at least 7 days old.
2. Sort the package keys in a stable manner.
3. Delete the existing `package-lock.json`.
4. Run `npm install` to generate an updated lockfile.

### Special Rules

- Packages published in the past 7 days are ignored when selecting upgrade versions.
- If the current package version is newer than the latest eligible version, it is left unchanged instead of being
  downgraded.
- `@types/node` is only upgraded to the latest eligible version within the same major version.

## Development

```bash
# Compile TypeScript
npm run build

# Format code with Prettier
npm run format

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch
```
