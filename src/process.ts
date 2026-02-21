import * as fs from 'fs/promises';
import * as path from 'path';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';
import { stringify } from './utils/json';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './utils/npm';
import { logger } from './utils/logger';

const upgradeSection = async (section: Record<string, string> | undefined) => {
  if (!section) {
    return;
  }

  const packages = Object.keys(section);
  for (const pkg of packages) {
    const currentRef = section[pkg];

    if (currentRef === '*') {
      logger.warn(`Skipping ${pkg} as it has '*' version`);
      continue;
    }

    const majorMatch = currentRef!.match(/(\d+)/);
    const currentMajor = majorMatch ? parseInt(majorMatch[0], 10) : null;

    let latestVersion = '';

    if (SAME_MAJOR_UPGRADE_PACKAGES.has(pkg) && currentMajor !== null) {
      latestVersion = await getLatestVersionOfMajor(pkg, currentMajor);
    } else {
      latestVersion = await getLatestVersion(pkg);
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
