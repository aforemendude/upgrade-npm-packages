import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestPackageVersion, getLatestPackageVersionOfMajor } from '../npm/get-latest-version';
import { logger } from '../utils/logger';
import { upgradeDependencySection } from './upgrade-dependency-section';

vi.mock('../npm/get-latest-version', () => ({
  getLatestPackageVersion: vi.fn(),
  getLatestPackageVersionOfMajor: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('upgradeDependencySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestPackageVersion).mockResolvedValue('2.0.0');
    vi.mocked(getLatestPackageVersionOfMajor).mockResolvedValue('18.2.0');
  });

  it('does nothing when the dependency section is absent', async () => {
    await upgradeDependencySection(undefined);

    expect(getLatestPackageVersion).not.toHaveBeenCalled();
    expect(getLatestPackageVersionOfMajor).not.toHaveBeenCalled();
  });

  it('skips empty and wildcard references while continuing through the section', async () => {
    const section = {
      empty: '',
      regular: '1.0.0',
      wildcard: '*',
    };

    await upgradeDependencySection(section);

    expect(getLatestPackageVersion).toHaveBeenCalledTimes(1);
    expect(getLatestPackageVersion).toHaveBeenCalledWith('regular', '1.0.0');
    expect(getLatestPackageVersionOfMajor).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith("Skipping wildcard as it has '*' version");
    expect(section).toEqual({ empty: '', regular: '2.0.0', wildcard: '*' });
  });

  it.each([
    ['^1.2.3', '1.2.3'],
    ['>=2', '>=2'],
    ['latest', 'latest'],
  ])('selects and pins a regular dependency from %p', async (currentReference, selectionConstraint) => {
    const section = { package: currentReference };

    await upgradeDependencySection(section);

    expect(getLatestPackageVersion).toHaveBeenCalledTimes(1);
    expect(getLatestPackageVersion).toHaveBeenCalledWith('package', selectionConstraint);
    expect(getLatestPackageVersionOfMajor).not.toHaveBeenCalled();
    expect(section).toEqual({ package: '2.0.0' });
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
  ])('preserves the non-registry reference %p without a registry lookup', async (currentReference) => {
    const section = { shared: currentReference };

    await upgradeDependencySection(section);

    expect(getLatestPackageVersion).not.toHaveBeenCalled();
    expect(getLatestPackageVersionOfMajor).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Skipping shared as it does not use a supported npm registry reference');
    expect(section).toEqual({ shared: currentReference });
  });

  it.each([
    ['@types/node', '^18.1.0', 18, '18.1.0'],
    ['eslint', '^18', 18, '^18'],
  ])(
    'keeps %s on its selected major for reference %s',
    async (packageName, currentReference, expectedMajor, selectionConstraint) => {
      const section = { [packageName]: currentReference };

      await upgradeDependencySection(section);

      expect(getLatestPackageVersionOfMajor).toHaveBeenCalledTimes(1);
      expect(getLatestPackageVersionOfMajor).toHaveBeenCalledWith(packageName, expectedMajor, selectionConstraint);
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
      expect(section).toEqual({ [packageName]: '18.2.0' });
    },
  );

  it('selects an aliased package by registry name and preserves the alias', async () => {
    const section = {
      'node-types': 'npm:@types/node@^18.1.0',
    };

    await upgradeDependencySection(section);

    expect(getLatestPackageVersionOfMajor).toHaveBeenCalledTimes(1);
    expect(getLatestPackageVersionOfMajor).toHaveBeenCalledWith('@types/node', 18, '18.1.0');
    expect(section).toEqual({
      'node-types': 'npm:@types/node@18.2.0',
    });
  });

  it('keeps the current reference when selection returns no version', async () => {
    vi.mocked(getLatestPackageVersion).mockResolvedValueOnce('');
    const section = { package: '^1.2.3' };

    await upgradeDependencySection(section);

    expect(section).toEqual({ package: '^1.2.3' });
  });

  it('propagates a version-selection failure without changing the reference', async () => {
    const selectionError = new Error('registry unavailable');
    vi.mocked(getLatestPackageVersion).mockRejectedValueOnce(selectionError);
    const section = { package: '1.0.0' };

    await expect(upgradeDependencySection(section)).rejects.toBe(selectionError);
    expect(section).toEqual({ package: '1.0.0' });
  });
});
