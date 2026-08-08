# Changelog

## Unreleased

### Added

- Add `--allow-symlinks` to explicitly permit processing symbolic-link `package.json` targets, including targets outside
  the scanned directory.
- Add `--no-color` to explicitly disable ANSI colors in CLI output.

### Changed

- Reject symbolic-link manifests before changing files unless `--allow-symlinks` is passed.
- Deduplicate allowed manifests by canonical target path so each file is processed only once.
- Emit plain log prefixes for redirected output and when the conventional `NO_COLOR` environment variable is set.

## 3.0.0 - 2026-08-02

### Changed

- Require Node.js 20 or newer.
- Preserve non-registry dependency references, including workspace, file, link, Git, and URL references, instead of
  replacing them with registry versions.
- Respect the full declared range for packages with a same-major upgrade policy when that range permits multiple major
  versions.
- Preserve conditional key order in `exports` and `imports` while continuing to sort ordinary `package.json` keys.
- Skip symbolic-link manifests when recursively discovering `package.json` files.

### Added

- Add the MIT license file.

## 2.1.2 - 2026-08-01

### Fixed

- Upgrade npm alias dependencies using the aliased registry package name while preserving the `npm:` alias syntax,
  including scoped packages and same-major restrictions.

## 2.1.1 - 2026-06-07

### Changed

- Check deprecated status one eligible candidate version at a time instead of fetching broad deprecation metadata.
- Skip deprecated-version checks for candidate versions below the current `package.json` SemVer version.

## 2.1.0 - 2026-06-07

### Changed

- Exclude deprecated package versions from upgrade selection.
- Skip the minimum package age requirement for packages in the `@aforemendude` namespace while keeping the 7-day minimum
  for other packages.
- Move package age and deprecation metadata policy constants into shared configuration.

## 2.0.0 - 2026-06-07

### Changed

- Reject unexpected CLI arguments and print usage help before exiting.
- Stop deleting lockfiles and running `npm install` during default package upgrades.
- Add `--force-reinstall` to delete all discovered `package-lock.json` files and `node_modules` directories, then run
  one `npm install` from the current working directory.

## 1.0.3 - 2026-06-06

### Changed

- Update installation documentation to use the published npm package.

## 1.0.2 - 2026-06-06

### Changed

- Use `semver` for version parsing, comparison, range handling, and same-major detection.
- Pin the current exact SemVer version when it is newer than the latest eligible published version.
- Honor incomplete SemVer ranges such as `>=2` when selecting package versions.
- Pin the earliest published version satisfying an incomplete range when no satisfying version is at least 7 days old.

## 1.0.1 - 2026-06-04

- Initial release.
