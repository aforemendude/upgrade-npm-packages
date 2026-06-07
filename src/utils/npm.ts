import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import { gt, lt, minVersion, parse, satisfies, validRange } from 'semver';
import logger from './logger';

const MINIMUM_PACKAGE_AGE_DAYS = 7;
const MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE = '@aforemendude/';
const DEPRECATION_METADATA_RANGE = '>=0.0.0-0';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type VersionTimeMap = Record<string, string>;

type VersionMetadata = {
  versions: string[];
  versionTimes: VersionTimeMap;
  deprecatedVersions: Set<string>;
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

const normalizeDeprecatedVersions = (deprecatedMetadata: unknown): Set<string> => {
  const deprecatedVersions = new Set<string>();
  const addDeprecatedVersion = (entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return;
    }

    const { version, deprecated } = entry as { version?: unknown; deprecated?: unknown };
    if (typeof version === 'string' && typeof deprecated === 'string' && deprecated.length > 0) {
      deprecatedVersions.add(version);
    }
  };

  if (Array.isArray(deprecatedMetadata)) {
    for (const entry of deprecatedMetadata) {
      addDeprecatedVersion(entry);
    }
  } else {
    addDeprecatedVersion(deprecatedMetadata);
  }

  return deprecatedVersions;
};

const parseNpmJson = (stdout: string, fallback: unknown): unknown => {
  const trimmedStdout = stdout.trim();
  if (!trimmedStdout) {
    return fallback;
  }

  return JSON.parse(trimmedStdout) as unknown;
};

const getMinimumPackageAgeDays = (packageName: string): number =>
  packageName.startsWith(MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE) ? 0 : MINIMUM_PACKAGE_AGE_DAYS;

const getVersionMetadata = async (packageName: string): Promise<VersionMetadata> => {
  const [{ stdout: versionsStdout }, { stdout: deprecationsStdout }] = await Promise.all([
    runNpm(['view', packageName, 'versions', 'time', '--json']),
    runNpm(['view', `${packageName}@${DEPRECATION_METADATA_RANGE}`, 'version', 'deprecated', '--json']),
  ]);

  const metadata = parseNpmJson(versionsStdout.toString(), {});
  const deprecatedMetadata = parseNpmJson(deprecationsStdout.toString(), []);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { versions: [], versionTimes: {}, deprecatedVersions: normalizeDeprecatedVersions(deprecatedMetadata) };
  }

  const { versions, time } = metadata as { versions?: unknown; time?: unknown };
  return {
    versions: normalizeVersions(versions),
    versionTimes: normalizeVersionTimes(time),
    deprecatedVersions: normalizeDeprecatedVersions(deprecatedMetadata),
  };
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

const isCurrentVersionNewer = (
  currentReference: string | undefined,
  latestEligibleVersion: string,
  deprecatedVersions: Set<string>,
): boolean => {
  if (!currentReference || !parse(currentReference)) {
    return false;
  }

  if (deprecatedVersions.has(currentReference)) {
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
  deprecatedVersions: Set<string>,
  minimumPackageAgeDays: number,
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

    if (deprecatedVersions.has(version)) {
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

    if (!isOldEnough(version, versionTimes, minimumPackageAgeDays)) {
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

  if (
    latestEligibleVersion &&
    !rangeReference &&
    isCurrentVersionNewer(currentReference, latestEligibleVersion, deprecatedVersions)
  ) {
    return currentReference ?? '';
  }

  return latestEligibleVersion;
};

const getLatestEligibleVersion = async (
  packageName: string,
  currentReference?: string,
  major?: number,
): Promise<string> => {
  const { versions, versionTimes, deprecatedVersions } = await getVersionMetadata(packageName);
  const minimumPackageAgeDays = getMinimumPackageAgeDays(packageName);
  const matchingVersions =
    major === undefined ? versions : versions.filter((version) => parse(version)?.major === major);
  return findLatestEligibleVersion(
    matchingVersions,
    versionTimes,
    deprecatedVersions,
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
