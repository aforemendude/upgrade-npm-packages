import { describe, expect, it } from 'vitest';
import {
  extractVersionFromReference,
  getMajorVersionFromReference,
  resolveDependencyUpgradeTarget,
} from './dependency-reference';

describe('resolveDependencyUpgradeTarget', () => {
  it('uses the declared package for a regular dependency reference', () => {
    const target = resolveDependencyUpgradeTarget('typescript', '^5.0.0');

    expect(target.packageName).toBe('typescript');
    expect(target.versionReference).toBe('^5.0.0');
    expect(target.formatVersion('5.1.0')).toBe('5.1.0');
  });

  it.each([
    ['npm:typescript@^5.0.0', 'typescript', '^5.0.0', 'npm:typescript@5.1.0'],
    ['npm:@types/node@^20.0.0', '@types/node', '^20.0.0', 'npm:@types/node@5.1.0'],
    ['npm:typescript', 'typescript', undefined, 'npm:typescript@5.1.0'],
  ])(
    'resolves the npm alias %p and preserves its alias syntax',
    (reference, packageName, versionReference, formattedVersion) => {
      const target = resolveDependencyUpgradeTarget('custom-name', reference);

      expect(target.packageName).toBe(packageName);
      expect(target.versionReference).toBe(versionReference);
      expect(target.formatVersion('5.1.0')).toBe(formattedVersion);
    },
  );

  it('treats malformed npm alias syntax as a regular reference', () => {
    const target = resolveDependencyUpgradeTarget('custom-name', 'npm:typescript@');

    expect(target.packageName).toBe('custom-name');
    expect(target.versionReference).toBe('npm:typescript@');
    expect(target.formatVersion('5.1.0')).toBe('5.1.0');
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
