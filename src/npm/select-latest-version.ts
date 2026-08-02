import { lt, minVersion, parse, rcompare, satisfies, validRange } from 'semver';
import type { PackageVersionTimes } from './npm-registry';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type SelectLatestVersionOptions = {
  currentReference?: string;
  isVersionDeprecated: (version: string) => Promise<boolean>;
  minimumPackageAgeDays: number;
  versions: string[];
  versionTimes: PackageVersionTimes;
};

const isOldEnough = (version: string, versionTimes: PackageVersionTimes, minimumPackageAgeDays: number): boolean => {
  if (minimumPackageAgeDays === 0) {
    return true;
  }

  const publishedAt = versionTimes[version];
  if (!publishedAt) {
    return false;
  }

  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) {
    return false;
  }

  return publishedTime <= Date.now() - minimumPackageAgeDays * MILLISECONDS_PER_DAY;
};

const getRangeReference = (currentReference: string | undefined): string | undefined => {
  if (!currentReference || parse(currentReference)) {
    return undefined;
  }

  return validRange(currentReference) ? currentReference : undefined;
};

const rangeAllowsPrerelease = (rangeReference: string): boolean =>
  (minVersion(rangeReference)?.prerelease.length ?? 0) > 0;

export const selectLatestEligibleVersion = async ({
  currentReference,
  isVersionDeprecated,
  minimumPackageAgeDays,
  versions,
  versionTimes,
}: SelectLatestVersionOptions): Promise<string> => {
  const currentParsedVersion = currentReference ? parse(currentReference) : null;
  const currentVersion = currentParsedVersion?.version;
  const rangeReference = getRangeReference(currentReference);
  const allowPrerelease = currentParsedVersion
    ? currentParsedVersion.prerelease.length > 0
    : rangeReference
      ? rangeAllowsPrerelease(rangeReference)
      : false;
  const ageEligibleVersions: string[] = [];
  const satisfyingRangeVersions: string[] = [];
  const deprecationResults = new Map<string, boolean>();
  let hasVersionBelowCurrent = false;

  const isCandidateDeprecated = async (version: string): Promise<boolean> => {
    const cachedResult = deprecationResults.get(version);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const deprecated = await isVersionDeprecated(version);
    deprecationResults.set(version, deprecated);
    return deprecated;
  };

  for (const version of versions) {
    const parsedVersion = parse(version);
    if (!parsedVersion || (parsedVersion.prerelease.length > 0 && !allowPrerelease)) {
      continue;
    }

    if (rangeReference) {
      if (
        !satisfies(version, rangeReference, {
          includePrerelease: allowPrerelease,
        })
      ) {
        continue;
      }

      satisfyingRangeVersions.push(version);
    }

    if (!isOldEnough(version, versionTimes, minimumPackageAgeDays)) {
      continue;
    }

    ageEligibleVersions.push(version);
  }

  ageEligibleVersions.sort(rcompare);
  for (const version of ageEligibleVersions) {
    if (currentVersion && lt(version, currentVersion)) {
      hasVersionBelowCurrent = true;
      continue;
    }

    if (!(await isCandidateDeprecated(version))) {
      return version;
    }
  }

  if (rangeReference) {
    satisfyingRangeVersions.sort((a, b) => -rcompare(a, b));
    for (const version of satisfyingRangeVersions) {
      if (!(await isCandidateDeprecated(version))) {
        return version;
      }
    }

    return '';
  }

  if (
    currentReference &&
    currentVersion &&
    hasVersionBelowCurrent &&
    ageEligibleVersions.every((version) => lt(version, currentVersion))
  ) {
    return currentReference;
  }

  return '';
};
