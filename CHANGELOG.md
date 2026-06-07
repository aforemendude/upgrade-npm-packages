# Changelog

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
