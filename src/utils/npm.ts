import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import { minVersion, satisfies, validRange } from 'semver';
import logger from './logger';

const MINIMUM_PACKAGE_AGE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type VersionTimeMap = Record<string, string>;

type VersionMetadata = {
  versions: string[];
  versionTimes: VersionTimeMap;
};

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

const runNpm = (args: string[], options: ExecFileOptions = {}): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => {
      stdout += data;
    });
    child.stderr?.on('data', (data) => {
      stderr += data;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm ${args[0]} exited with code ${code}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const parseVersion = (version: string): ParsedVersion | null => {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.+)?$/);
  const major = match?.[1];
  const minor = match?.[2];
  const patch = match?.[3];
  if (!major || !minor || !patch) {
    return null;
  }

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: match[4] ? match[4].split('.') : [],
  };
};

const comparePrereleaseIdentifier = (left: string, right: string): number => {
  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);

  if (leftIsNumber && rightIsNumber) {
    return parseInt(left, 10) - parseInt(right, 10);
  }

  if (leftIsNumber !== rightIsNumber) {
    return leftIsNumber ? -1 : 1;
  }

  return left.localeCompare(right);
};

const compareVersions = (leftVersion: string, rightVersion: string): number | null => {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  if (!left || !right) {
    return null;
  }

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const identifierCount = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }

    if (rightIdentifier === undefined) {
      return 1;
    }

    const comparison = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
};

const normalizeVersions = (versions: unknown): string[] => {
  if (Array.isArray(versions)) {
    return versions.filter((version): version is string => typeof version === 'string');
  }

  return typeof versions === 'string' && versions ? [versions] : [];
};

const normalizeVersionTimes = (versionTimes: unknown): VersionTimeMap => {
  if (!versionTimes || typeof versionTimes !== 'object' || Array.isArray(versionTimes)) {
    return {};
  }

  return versionTimes as VersionTimeMap;
};

const getVersionMetadata = async (packageName: string): Promise<VersionMetadata> => {
  const { stdout } = await runNpm(['view', packageName, 'versions', 'time', '--json']);
  const metadata = JSON.parse(stdout.toString() || '{}') as unknown;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { versions: [], versionTimes: {} };
  }

  const { versions, time } = metadata as { versions?: unknown; time?: unknown };
  return {
    versions: normalizeVersions(versions),
    versionTimes: normalizeVersionTimes(time),
  };
};

const isOldEnough = (version: string, versionTimes: VersionTimeMap): boolean => {
  const publishedAt = versionTimes[version];
  if (!publishedAt) {
    return false;
  }

  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) {
    return false;
  }

  return publishedTime <= Date.now() - MINIMUM_PACKAGE_AGE_DAYS * MS_PER_DAY;
};

const isCurrentVersionNewer = (currentReference: string | undefined, latestEligibleVersion: string): boolean => {
  if (!currentReference) {
    return false;
  }

  const comparison = compareVersions(currentReference, latestEligibleVersion);
  return comparison !== null && comparison > 0;
};

const isRangeReference = (currentReference: string | undefined): currentReference is string => {
  if (!currentReference || parseVersion(currentReference)) {
    return false;
  }

  return validRange(currentReference) !== null;
};

const rangeAllowsPrerelease = (rangeReference: string): boolean => {
  const minimumVersion = minVersion(rangeReference);
  return (minimumVersion?.prerelease.length ?? 0) > 0;
};

const satisfiesRangeReference = (version: string, rangeReference: string, allowPrerelease: boolean): boolean => {
  return satisfies(version, rangeReference, { includePrerelease: allowPrerelease });
};

const findLatestEligibleVersion = (
  versions: string[],
  versionTimes: VersionTimeMap,
  currentReference?: string,
): string => {
  const currentParsedVersion = currentReference ? parseVersion(currentReference) : null;
  const rangeReference = isRangeReference(currentReference) ? currentReference : undefined;
  const allowPrerelease = currentParsedVersion
    ? currentParsedVersion.prerelease.length > 0
    : rangeReference
      ? rangeAllowsPrerelease(rangeReference)
      : false;
  let latestEligibleVersion = '';
  let earliestSatisfyingVersion = '';

  for (const version of versions) {
    const parsedVersion = parseVersion(version);
    if (!parsedVersion || (parsedVersion.prerelease.length > 0 && !allowPrerelease)) {
      continue;
    }

    if (rangeReference) {
      if (!satisfiesRangeReference(version, rangeReference, allowPrerelease)) {
        continue;
      }

      if (!earliestSatisfyingVersion) {
        earliestSatisfyingVersion = version;
      } else {
        const earliestComparison = compareVersions(version, earliestSatisfyingVersion);
        if (earliestComparison !== null && earliestComparison < 0) {
          earliestSatisfyingVersion = version;
        }
      }
    }

    if (!isOldEnough(version, versionTimes)) {
      continue;
    }

    if (!latestEligibleVersion) {
      latestEligibleVersion = version;
      continue;
    }

    const comparison = compareVersions(version, latestEligibleVersion);
    if (comparison !== null && comparison > 0) {
      latestEligibleVersion = version;
    }
  }

  if (!latestEligibleVersion && rangeReference) {
    return earliestSatisfyingVersion;
  }

  if (latestEligibleVersion && !rangeReference && isCurrentVersionNewer(currentReference, latestEligibleVersion)) {
    return currentReference ?? '';
  }

  return latestEligibleVersion;
};

const getLatestEligibleVersion = async (
  packageName: string,
  currentReference?: string,
  major?: number,
): Promise<string> => {
  const { versions, versionTimes } = await getVersionMetadata(packageName);
  const matchingVersions =
    major === undefined ? versions : versions.filter((version) => parseVersion(version)?.major === major);
  return findLatestEligibleVersion(matchingVersions, versionTimes, currentReference);
};

export const getLatestVersion = async (packageName: string, currentReference?: string): Promise<string> => {
  try {
    return await getLatestEligibleVersion(packageName, currentReference);
  } catch (error) {
    logger.error(`Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
};

export const getLatestVersionOfMajor = async (
  packageName: string,
  major: number,
  currentReference?: string,
): Promise<string> => {
  try {
    return await getLatestEligibleVersion(packageName, currentReference, major);
  } catch (error) {
    logger.error(`Could not fetch versions for ${packageName}@${major}. Skipping...`);
    return '';
  }
};

export const installPackages = async (cwd: string): Promise<void> => {
  await runNpm(['install'], { cwd });
};
