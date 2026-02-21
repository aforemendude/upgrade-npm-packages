import * as fs from 'fs/promises';
import * as path from 'path';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';
import { stringify } from './utils/json';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './utils/npm';

const upgradeSection = async (section: Record<string, string> | undefined) => {
  if (!section) {
    return;
  }

  const packages = Object.keys(section);
  for (const pkg of packages) {
    const currentRef = section[pkg];

    if (currentRef === '*') {
      console.warn(`WARN: Skipping ${pkg} as it has '*' version`);
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
    console.log(`Successfully upgraded packages in ${filePath}`);

    const dir = path.dirname(filePath);
    const lockfilePath = path.join(dir, 'package-lock.json');

    try {
      await fs.unlink(lockfilePath);
      console.log(`Deleted ${lockfilePath}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        console.warn(`WARN: Failed to delete ${lockfilePath}:`, e.message);
      }
    }

    console.log(`Running npm install in ${dir}...`);
    await installPackages(dir);

    console.log(`Successfully refreshed lockfile in ${dir}`);
  } catch (error) {
    console.error(`ERROR: Unable to process ${filePath}:`, error);
    throw error;
  }
};
