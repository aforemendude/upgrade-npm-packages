import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import { lt, minVersion, parse, rcompare, satisfies, validRange } from 'semver';
import { MINIMUM_PACKAGE_AGE_DAYS, MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE } from '../config';
import logger from './logger';

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

const parseNpmJson = (stdout: string, fallback: unknown): unknown => {
  const trimmedStdout = stdout.trim();
  if (!trimmedStdout || trimmedStdout === 'undefined') {
    return fallback;
  }

  return JSON.parse(trimmedStdout) as unknown;
};

const getMinimumPackageAgeDays = (packageName: string): number =>
  packageName.startsWith(MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE) ? 0 : MINIMUM_PACKAGE_AGE_DAYS;

const getVersionMetadata = async (packageName: string): Promise<VersionMetadata> => {
  const { stdout: versionsStdout } = await runNpm(['view', packageName, 'versions', 'time', '--json']);

  const metadata = parseNpmJson(versionsStdout.toString(), {});
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { versions: [], versionTimes: {} };
  }

  const { versions, time } = metadata as { versions?: unknown; time?: unknown };
  return {
    versions: normalizeVersions(versions),
    versionTimes: normalizeVersionTimes(time),
  };
};

const isDeprecatedVersion = async (packageName: string, version: string): Promise<boolean> => {
  const { stdout } = await runNpm(['view', `${packageName}@${version}`, 'deprecated', '--json']);
  const deprecated = parseNpmJson(stdout.toString(), '');
  return typeof deprecated === 'string' && deprecated.length > 0;
};

const isOldEnough = (version: string, versionTimes: VersionTimeMap, minimumPackageAgeDays: number): boolean => {
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

  return publishedTime <= Date.now() - minimumPackageAgeDays * MS_PER_DAY;
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

const findLatestEligibleVersion = async (
  packageName: string,
  versions: string[],
  versionTimes: VersionTimeMap,
  minimumPackageAgeDays: number,
  currentReference?: string,
): Promise<string> => {
  const currentParsedVersion = currentReference ? parse(currentReference) : null;
  const currentVersion = currentParsedVersion?.version;
  const rangeReference = isRangeReference(currentReference) ? currentReference : undefined;
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
    if (deprecationResults.has(version)) {
      return deprecationResults.get(version) ?? false;
    }

    const deprecated = await isDeprecatedVersion(packageName, version);
    deprecationResults.set(version, deprecated);
    return deprecated;
  };

  for (const version of versions) {
    const parsedVersion = parse(version);
    if (!parsedVersion || (parsedVersion.prerelease.length > 0 && !allowPrerelease)) {
      continue;
    }

    if (rangeReference) {
      if (!satisfiesRangeReference(version, rangeReference, allowPrerelease)) {
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
    return currentReference ?? '';
  }

  return '';
};

const getLatestEligibleVersion = async (
  packageName: string,
  currentReference?: string,
  major?: number,
): Promise<string> => {
  const { versions, versionTimes } = await getVersionMetadata(packageName);
  const minimumPackageAgeDays = getMinimumPackageAgeDays(packageName);
  const matchingVersions =
    major === undefined ? versions : versions.filter((version) => parse(version)?.major === major);
  return findLatestEligibleVersion(
    packageName,
    matchingVersions,
    versionTimes,
    minimumPackageAgeDays,
    currentReference,
  );
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
