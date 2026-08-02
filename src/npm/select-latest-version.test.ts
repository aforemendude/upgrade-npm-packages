import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectLatestEligibleVersion } from './select-latest-version';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-15T12:00:00.000Z').getTime();
const daysAgo = (days: number): string => new Date(NOW - days * MILLISECONDS_PER_DAY).toISOString();

describe('selectLatestEligibleVersion', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects the newest old-enough stable version and ignores invalid candidates', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(false);

    await expect(
      selectLatestEligibleVersion({
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['invalid', '1.0.0', '3.0.0-beta.1', '2.0.0'],
        versionTimes: {
          '1.0.0': daysAgo(30),
          '2.0.0': daysAgo(10),
          '3.0.0-beta.1': daysAgo(20),
        },
      }),
    ).resolves.toBe('2.0.0');
    expect(isVersionDeprecated).toHaveBeenCalledTimes(1);
    expect(isVersionDeprecated).toHaveBeenCalledWith('2.0.0');
  });

  it('ignores recent versions and versions with missing or invalid publication times', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(true);

    await expect(
      selectLatestEligibleVersion({
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['1.0.0', '1.1.0', '1.2.0', '1.3.0'],
        versionTimes: {
          '1.0.0': daysAgo(30),
          '1.1.0': daysAgo(1),
          '1.2.0': 'not-a-date',
        },
      }),
    ).resolves.toBe('');
    expect(isVersionDeprecated).toHaveBeenCalledTimes(1);
    expect(isVersionDeprecated).toHaveBeenCalledWith('1.0.0');
  });

  it('bypasses publication times when the minimum age is zero and skips deprecated versions', async () => {
    const isVersionDeprecated = vi.fn(async (version: string) => version === '2.0.0');

    await expect(
      selectLatestEligibleVersion({
        isVersionDeprecated,
        minimumPackageAgeDays: 0,
        versions: ['1.0.0', '2.0.0'],
        versionTimes: {},
      }),
    ).resolves.toBe('1.0.0');
    expect(isVersionDeprecated.mock.calls).toEqual([['2.0.0'], ['1.0.0']]);
  });

  it('allows prerelease candidates when the current reference is a prerelease', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(false);

    await expect(
      selectLatestEligibleVersion({
        currentReference: '2.0.0-beta.1',
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['2.0.0-beta.1', '2.0.0-beta.2'],
        versionTimes: {
          '2.0.0-beta.1': daysAgo(20),
          '2.0.0-beta.2': daysAgo(10),
        },
      }),
    ).resolves.toBe('2.0.0-beta.2');
  });

  it('selects the newest old-enough version that satisfies a range', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(false);

    await expect(
      selectLatestEligibleVersion({
        currentReference: '^2.0.0',
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['1.9.0', '2.0.0', '2.1.0', '2.2.0', '3.0.0'],
        versionTimes: {
          '1.9.0': daysAgo(30),
          '2.0.0': daysAgo(20),
          '2.1.0': daysAgo(10),
          '2.2.0': daysAgo(1),
          '3.0.0': daysAgo(30),
        },
      }),
    ).resolves.toBe('2.1.0');
    expect(isVersionDeprecated).toHaveBeenCalledTimes(1);
    expect(isVersionDeprecated).toHaveBeenCalledWith('2.1.0');
  });

  it('falls back to the earliest nondeprecated range version when none are old enough', async () => {
    const isVersionDeprecated = vi.fn(async (version: string) => version === '2.0.0');

    await expect(
      selectLatestEligibleVersion({
        currentReference: '>=2 <3',
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['2.2.0', '1.9.0', '2.1.0', '2.0.0', '3.0.0'],
        versionTimes: {
          '1.9.0': daysAgo(30),
          '2.0.0': daysAgo(1),
          '2.1.0': daysAgo(1),
          '2.2.0': daysAgo(1),
          '3.0.0': daysAgo(30),
        },
      }),
    ).resolves.toBe('2.1.0');
    expect(isVersionDeprecated.mock.calls).toEqual([['2.0.0'], ['2.1.0']]);
  });

  it('returns no version when a range has no matching candidates', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(false);

    await expect(
      selectLatestEligibleVersion({
        currentReference: '^3.0.0',
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['1.0.0', '2.0.0'],
        versionTimes: {
          '1.0.0': daysAgo(30),
          '2.0.0': daysAgo(30),
        },
      }),
    ).resolves.toBe('');
    expect(isVersionDeprecated).not.toHaveBeenCalled();
  });

  it('preserves an exact current reference newer than every eligible registry version', async () => {
    const isVersionDeprecated = vi.fn().mockResolvedValue(false);

    await expect(
      selectLatestEligibleVersion({
        currentReference: 'v3.0.0',
        isVersionDeprecated,
        minimumPackageAgeDays: 7,
        versions: ['1.0.0', '2.0.0'],
        versionTimes: {
          '1.0.0': daysAgo(30),
          '2.0.0': daysAgo(20),
        },
      }),
    ).resolves.toBe('v3.0.0');
    expect(isVersionDeprecated).not.toHaveBeenCalled();
  });
});
