# Changelog

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
