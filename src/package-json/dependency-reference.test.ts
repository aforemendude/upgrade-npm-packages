import { describe, expect, it } from 'vitest';
import {
  extractVersionFromReference,
  getMajorVersionFromReference,
  resolveDependencyUpgradeTarget,
} from './dependency-reference';

describe('resolveDependencyUpgradeTarget', () => {
  it.each(['5.0.0', '^5.0.0', 'latest'])('uses the declared package for the registry reference %p', (reference) => {
    const target = resolveDependencyUpgradeTarget('typescript', reference);

    expect(target?.packageName).toBe('typescript');
    expect(target?.versionReference).toBe(reference);
    expect(target?.formatVersion('5.1.0')).toBe('5.1.0');
  });

  it.each([
    ['npm:typescript@^5.0.0', 'typescript', '^5.0.0', 'npm:typescript@5.1.0'],
    ['npm:@types/node@^20.0.0', '@types/node', '^20.0.0', 'npm:@types/node@5.1.0'],
    ['npm:typescript', 'typescript', undefined, 'npm:typescript@5.1.0'],
  ])(
    'resolves the npm alias %p and preserves its alias syntax',
    (reference, packageName, versionReference, formattedVersion) => {
      const target = resolveDependencyUpgradeTarget('custom-name', reference);

      expect(target?.packageName).toBe(packageName);
      expect(target?.versionReference).toBe(versionReference);
      expect(target?.formatVersion('5.1.0')).toBe(formattedVersion);
    },
  );

  it('treats an npm alias with an empty version as a wildcard alias', () => {
    const target = resolveDependencyUpgradeTarget('custom-name', 'npm:typescript@');

    expect(target?.packageName).toBe('typescript');
    expect(target?.versionReference).toBe('*');
    expect(target?.formatVersion('5.1.0')).toBe('npm:typescript@5.1.0');
  });

  it.each([
    'workspace:*',
    'workspace:^1.2.3',
    'file:../shared',
    'link:../shared',
    '../shared',
    './shared.tgz',
    'github:owner/repository#v1.2.3',
    'git+https://github.com/owner/repository.git#v1.2.3',
    'https://example.com/shared.tgz',
  ])('does not resolve the non-registry reference %p as an upgrade target', (reference) => {
    expect(resolveDependencyUpgradeTarget('shared', reference)).toBeUndefined();
  });
});

describe('extractVersionFromReference', () => {
  it.each([
    ['1.2.3', '1.2.3'],
    ['^1.2.3', '1.2.3'],
    ['workspace:^1.2.3', '1.2.3'],
    ['github:owner/repository#v1.2.3', '1.2.3'],
    ['2.0.0-beta.1', '2.0.0-beta.1'],
    ['>=2', undefined],
    ['latest', undefined],
  ])('extracts %p as %p', (reference, expectedVersion) => {
    expect(extractVersionFromReference(reference)).toBe(expectedVersion);
  });
});

describe('getMajorVersionFromReference', () => {
  it.each([
    ['1.2.3', 1],
    ['^18.1.0', 18],
    ['^18', 18],
    ['>=20 <21', 20],
    ['workspace:^3.2.1', 3],
    ['latest', null],
  ])('resolves the major for %p as %p', (reference, expectedMajor) => {
    expect(getMajorVersionFromReference(reference)).toBe(expectedMajor);
  });
});
