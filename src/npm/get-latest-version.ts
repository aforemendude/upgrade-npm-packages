import { parse } from 'semver';
import { MINIMUM_PACKAGE_AGE_DAYS, MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE } from '../config/dependency-upgrade-policy';
import { logger } from '../utils/logger';
import { getPackageVersionMetadata, isPackageVersionDeprecated } from './npm-registry';
import { selectLatestEligibleVersion } from './select-latest-version';

type LatestVersionRequest = {
  currentReference?: string;
  major?: number;
  packageName: string;
};

const getMinimumPackageAgeDays = (packageName: string): number =>
  packageName.startsWith(MINIMUM_PACKAGE_AGE_EXEMPT_SCOPE) ? 0 : MINIMUM_PACKAGE_AGE_DAYS;

const fetchLatestEligibleVersion = async ({
  currentReference,
  major,
  packageName,
}: LatestVersionRequest): Promise<string> => {
  const { versions, versionTimes } = await getPackageVersionMetadata(packageName);
  const matchingVersions =
    major === undefined ? versions : versions.filter((version) => parse(version)?.major === major);

  return selectLatestEligibleVersion({
    currentReference,
    isVersionDeprecated: (version) => isPackageVersionDeprecated(packageName, version),
    minimumPackageAgeDays: getMinimumPackageAgeDays(packageName),
    versions: matchingVersions,
    versionTimes,
  });
};

const safelyFetchLatestVersion = async (request: LatestVersionRequest, errorMessage: string): Promise<string> => {
  try {
    return await fetchLatestEligibleVersion(request);
  } catch {
    logger.error(errorMessage);
    return '';
  }
};

export const getLatestPackageVersion = async (packageName: string, currentReference?: string): Promise<string> =>
  safelyFetchLatestVersion(
    { packageName, currentReference },
    `Could not fetch the latest version for ${packageName}. Skipping...`,
  );

export const getLatestPackageVersionOfMajor = async (
  packageName: string,
  major: number,
  currentReference?: string,
): Promise<string> =>
  safelyFetchLatestVersion(
    { packageName, currentReference, major },
    `Could not fetch versions for ${packageName}@${major}. Skipping...`,
  );
