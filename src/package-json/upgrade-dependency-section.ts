import { SAME_MAJOR_UPGRADE_PACKAGES } from '../config/dependency-upgrade-policy';
import { getLatestPackageVersion, getLatestPackageVersionOfMajor } from '../npm/get-latest-version';
import { logger } from '../utils/logger';
import {
  extractVersionFromReference,
  getMajorVersionFromReference,
  resolveDependencyUpgradeTarget,
} from './dependency-reference';

export type DependencySection = Record<string, string>;

export const upgradeDependencySection = async (section: DependencySection | undefined): Promise<void> => {
  if (!section) {
    return;
  }

  for (const packageName of Object.keys(section)) {
    const currentReference = section[packageName];
    if (!currentReference) {
      continue;
    }

    const target = resolveDependencyUpgradeTarget(packageName, currentReference);
    if (target.versionReference === '*') {
      logger.warn(`Skipping ${packageName} as it has '*' version`);
      continue;
    }

    const currentVersion = target.versionReference ? extractVersionFromReference(target.versionReference) : undefined;
    const selectionConstraint = currentVersion ?? target.versionReference;
    const currentMajor = target.versionReference ? getMajorVersionFromReference(target.versionReference) : null;
    const selectedVersion =
      SAME_MAJOR_UPGRADE_PACKAGES.has(target.packageName) && currentMajor !== null
        ? await getLatestPackageVersionOfMajor(target.packageName, currentMajor, selectionConstraint)
        : await getLatestPackageVersion(target.packageName, selectionConstraint);

    if (selectedVersion) {
      section[packageName] = target.formatVersion(selectedVersion);
    }
  }
};
