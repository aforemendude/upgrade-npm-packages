# Upgrade NPM Packages

A tool to recursively search for `package.json` files and upgrade all packages to their latest versions.

## Installation

To use this tool globally, you can clone the repository and use `npm link`:

```bash
npm install
npm run build
npm link
```

## Usage

After linking, you can run the tool from anywhere:

```bash
upgrade-npm-packages
```

The tool will search for `package.json` files in the current directory and all subdirectories, upgrading dependencies to
their latest versions.

### Special Rules

- `@types/node` is only upgraded to the latest version within the same major version.
