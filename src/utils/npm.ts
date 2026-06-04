import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import logger from './logger';

const MINIMUM_PACKAGE_AGE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type VersionTimeMap = Record<string, string>;

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

const getVersions = async (packageName: string, major?: number): Promise<string[]> => {
  if (major === undefined) {
    const { stdout } = await runNpm(['view', packageName, 'versions', '--json']);
    return normalizeVersions(JSON.parse(stdout.toString() || '""'));
  }

  const packageSpec = `${packageName}@${major}`;
  const { stdout } = await runNpm(['view', packageSpec, 'version', '--json']);
  return normalizeVersions(JSON.parse(stdout.toString() || '""'));
};

const getVersionTimes = async (packageName: string): Promise<VersionTimeMap> => {
  const { stdout } = await runNpm(['view', packageName, 'time', '--json']);
  const versionTimes = JSON.parse(stdout.toString() || '{}') as unknown;
  if (!versionTimes || typeof versionTimes !== 'object' || Array.isArray(versionTimes)) {
    return {};
  }

  return versionTimes as VersionTimeMap;
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

const isCurrentVersionNewer = (currentVersion: string | undefined, latestEligibleVersion: string): boolean => {
  if (!currentVersion) {
    return false;
  }

  const comparison = compareVersions(currentVersion, latestEligibleVersion);
  return comparison !== null && comparison > 0;
};

const findLatestEligibleVersion = (
  versions: string[],
  versionTimes: VersionTimeMap,
  currentVersion?: string,
): string => {
  const currentParsedVersion = currentVersion ? parseVersion(currentVersion) : null;
  const allowPrerelease = currentParsedVersion ? currentParsedVersion.prerelease.length > 0 : false;
  let latestEligibleVersion = '';

  for (const version of versions) {
    const parsedVersion = parseVersion(version);
    if (
      !parsedVersion ||
      (parsedVersion.prerelease.length > 0 && !allowPrerelease) ||
      !isOldEnough(version, versionTimes)
    ) {
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

  if (latestEligibleVersion && isCurrentVersionNewer(currentVersion, latestEligibleVersion)) {
    return '';
  }

  return latestEligibleVersion;
};

const getLatestEligibleVersion = async (
  packageName: string,
  currentVersion?: string,
  major?: number,
): Promise<string> => {
  const versions = await getVersions(packageName, major);
  const versionTimes = await getVersionTimes(packageName);
  return findLatestEligibleVersion(versions, versionTimes, currentVersion);
};

export const getLatestVersion = async (packageName: string, currentVersion?: string): Promise<string> => {
  try {
    return await getLatestEligibleVersion(packageName, currentVersion);
  } catch (error) {
    logger.error(`Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
};

export const getLatestVersionOfMajor = async (
  packageName: string,
  major: number,
  currentVersion?: string,
): Promise<string> => {
  try {
    return await getLatestEligibleVersion(packageName, currentVersion, major);
  } catch (error) {
    logger.error(`Could not fetch versions for ${packageName}@${major}. Skipping...`);
    return '';
  }
};

export const installPackages = async (cwd: string): Promise<void> => {
  await runNpm(['install'], { cwd });
};
