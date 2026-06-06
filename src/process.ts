import * as fs from 'fs/promises';
import * as path from 'path';
import { coerce, minVersion, parse, validRange } from 'semver';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';
import { stringify } from './utils/json';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './utils/npm';
import { logger } from './utils/logger';

const extractVersion = (versionRef: string): string | undefined => {
  const version = coerce(versionRef, { includePrerelease: true });
  if (!version || !versionRef.includes(version.raw)) {
    return undefined;
  }

  return version.raw;
};

const getMinimumVersion = (versionRef: string) => {
  if (!validRange(versionRef)) {
    return null;
  }

  return minVersion(versionRef);
};

const getMajorVersion = (versionRef: string): number | null => {
  const exactVersion = extractVersion(versionRef);
  if (exactVersion) {
    return parse(exactVersion)?.major ?? null;
  }

  const minimumVersion = getMinimumVersion(versionRef);
  if (!minimumVersion) {
    return null;
  }

  return minimumVersion.major;
};

const upgradeSection = async (section: Record<string, string> | undefined) => {
  if (!section) {
    return;
  }

  const packages = Object.keys(section);
  for (const pkg of packages) {
    const currentRef = section[pkg];

    if (!currentRef) {
      continue;
    }

    if (currentRef === '*') {
      logger.warn(`Skipping ${pkg} as it has '*' version`);
      continue;
    }

    const currentVersion = extractVersion(currentRef);
    const currentVersionReference = currentVersion ?? currentRef;
    const currentMajor = getMajorVersion(currentRef);

    let latestVersion = '';

    if (SAME_MAJOR_UPGRADE_PACKAGES.has(pkg) && currentMajor !== null) {
      latestVersion = await getLatestVersionOfMajor(pkg, currentMajor, currentVersionReference);
    } else {
      latestVersion = await getLatestVersion(pkg, currentVersionReference);
    }

    if (latestVersion) {
      section[pkg] = latestVersion;
    }
  }
};

export const upgradePackageJson = async (filePath: string): Promise<void> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const packageJson = JSON.parse(content);

    await upgradeSection(packageJson.dependencies);
    await upgradeSection(packageJson.devDependencies);

    const formattedJson = stringify(packageJson);
    await fs.writeFile(filePath, formattedJson, 'utf-8');
    logger.success(`Successfully upgraded packages in ${filePath}`);

    const dir = path.dirname(filePath);
    const lockfilePath = path.join(dir, 'package-lock.json');

    try {
      await fs.unlink(lockfilePath);
      logger.info(`Deleted ${lockfilePath}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        logger.warn(`Failed to delete ${lockfilePath}: ${e.message}`);
      }
    }

    logger.info(`Running npm install in ${dir}...`);
    await installPackages(dir);

    logger.success(`Successfully refreshed lockfile in ${dir}`);
  } catch (error) {
    logger.error(`Unable to process ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
};
