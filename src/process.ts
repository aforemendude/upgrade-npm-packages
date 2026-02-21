import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';
import { stringify } from './utils/json';
import { getLatestVersion, getLatestVersionOfMajor } from './utils/npm';

const execFileAsync = promisify(execFile);

const upgradeSection = async (section: Record<string, string> | undefined) => {
  if (!section) {
    return;
  }

  const packages = Object.keys(section);
  for (const pkg of packages) {
    const currentRef = section[pkg];

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
        console.warn(`Failed to delete ${lockfilePath}:`, e.message);
      }
    }

    console.log(`Running npm install in ${dir}...`);
    await execFileAsync('npm', ['install'], { cwd: dir });

    console.log(`Successfully refreshed lockfile in ${dir}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    throw error;
  }
};
