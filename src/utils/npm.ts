import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import { gt, lt, minVersion, parse, satisfies, validRange } from 'semver';
import logger from './logger';

const MINIMUM_PACKAGE_AGE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type VersionTimeMap = Record<string, string>;

type VersionMetadata = {
  versions: string[];
  versionTimes: VersionTimeMap;
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
  if (!currentReference || !parse(currentReference)) {
    return false;
  }

  return gt(currentReference, latestEligibleVersion);
};

const isRangeReference = (currentReference: string | undefined): currentReference is string => {
  if (!currentReference || parse(currentReference)) {
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
  const currentParsedVersion = currentReference ? parse(currentReference) : null;
  const rangeReference = isRangeReference(currentReference) ? currentReference : undefined;
  const allowPrerelease = currentParsedVersion
    ? currentParsedVersion.prerelease.length > 0
    : rangeReference
      ? rangeAllowsPrerelease(rangeReference)
      : false;
  let latestEligibleVersion = '';
  let earliestSatisfyingVersion = '';

  for (const version of versions) {
    const parsedVersion = parse(version);
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
        if (lt(version, earliestSatisfyingVersion)) {
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

    if (gt(version, latestEligibleVersion)) {
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
    major === undefined ? versions : versions.filter((version) => parse(version)?.major === major);
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
