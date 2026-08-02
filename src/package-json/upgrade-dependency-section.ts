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
    if (!target) {
      logger.warn(`Skipping ${packageName} as it does not use a supported npm registry reference`);
      continue;
    }

    if (target.versionReference === '*') {
      logger.warn(`Skipping ${packageName} as it has '*' version`);
      continue;
    }

    const currentVersion = target.versionReference ? extractVersionFromReference(target.versionReference) : undefined;
    const usesSameMajorPolicy = SAME_MAJOR_UPGRADE_PACKAGES.has(target.packageName);
    const currentMajor =
      usesSameMajorPolicy && target.versionReference ? getMajorVersionFromReference(target.versionReference) : null;
    const selectsSameMajor = usesSameMajorPolicy && currentMajor !== null;
    const selectionConstraint =
      usesSameMajorPolicy && !selectsSameMajor ? target.versionReference : (currentVersion ?? target.versionReference);
    const selectedVersion = selectsSameMajor
      ? await getLatestPackageVersionOfMajor(target.packageName, currentMajor, selectionConstraint)
      : await getLatestPackageVersion(target.packageName, selectionConstraint);

    if (selectedVersion) {
      section[packageName] = target.formatVersion(selectedVersion);
    }
  }
};
