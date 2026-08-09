import { parse } from 'semver';
import { MINIMUM_PACKAGE_AGE_DAYS, MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE } from '../config/dependency-upgrade-policy';
import { logger } from '../utils/logger';
import { type NpmRegistry, uncachedNpmRegistry } from './npm-registry';
import { selectLatestEligibleVersion } from './select-latest-version';

type LatestVersionRequest = {
  currentReference?: string;
  major?: number;
  packageName: string;
};

const getMinimumPackageAgeDays = (packageName: string): number =>
  packageName.startsWith(MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE) ? 0 : MINIMUM_PACKAGE_AGE_DAYS;

const fetchLatestEligibleVersion = async (
  { currentReference, major, packageName }: LatestVersionRequest,
  npmRegistry: NpmRegistry,
): Promise<string> => {
  const { versions, versionTimes } = await npmRegistry.getPackageVersionMetadata(packageName);
  const matchingVersions =
    major === undefined ? versions : versions.filter((version) => parse(version)?.major === major);

  return selectLatestEligibleVersion({
    currentReference,
    isVersionDeprecated: (version) => npmRegistry.isPackageVersionDeprecated(packageName, version),
    minimumPackageAgeDays: getMinimumPackageAgeDays(packageName),
    versions: matchingVersions,
    versionTimes,
  });
};

const safelyFetchLatestVersion = async (
  request: LatestVersionRequest,
  errorMessage: string,
  npmRegistry: NpmRegistry,
): Promise<string> => {
  try {
    return await fetchLatestEligibleVersion(request, npmRegistry);
  } catch {
    logger.error(errorMessage);
    return '';
  }
};

export const getLatestPackageVersion = async (
  packageName: string,
  currentReference?: string,
  npmRegistry: NpmRegistry = uncachedNpmRegistry,
): Promise<string> =>
  safelyFetchLatestVersion(
    { packageName, currentReference },
    `Could not determine an eligible version for ${packageName}. Skipping...`,
    npmRegistry,
  );

export const getLatestPackageVersionOfMajor = async (
  packageName: string,
  major: number,
  currentReference?: string,
  npmRegistry: NpmRegistry = uncachedNpmRegistry,
): Promise<string> =>
  safelyFetchLatestVersion(
    { packageName, currentReference, major },
    `Could not determine an eligible version for ${packageName} in major ${major}. Skipping...`,
    npmRegistry,
  );
