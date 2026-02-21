import * as fs from 'fs/promises';
import { getLatestVersion, getLatestVersionOfMajor } from './utils/npm';
import { stringify } from './utils/json';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';

export const upgradePackageJson = async (filePath: string): Promise<void> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const packageJson = JSON.parse(content);

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

    await upgradeSection(packageJson.dependencies);
    await upgradeSection(packageJson.devDependencies);

    const formattedJson = stringify(packageJson);
    await fs.writeFile(filePath, formattedJson, 'utf-8');
    console.log(`Successfully upgraded packages in ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    throw error;
  }
}
