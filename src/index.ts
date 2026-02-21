import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Recursively sort the keys of an object alphabetically.
 */
function sortKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  } else if (obj !== null && typeof obj === 'object') {
    const sortedObj: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sortedObj[key] = sortKeys(obj[key]);
      });
    return sortedObj;
  }
  return obj;
}

/**
 * Fetch the latest version of a package from NPM.
 */
function getLatestVersion(packageName: string): string {
  try {
    const output = execSync(`npm view ${packageName} version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    return output.trim();
  } catch (error) {
    console.warn(`Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
}

function main() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: package.json not found in the current directory (${process.cwd()})`);
    process.exit(1);
  }

  console.log(`Found package.json at ${packageJsonPath}`);

  const packageJsonStr = fs.readFileSync(packageJsonPath, 'utf-8');
  let packageJson: Record<string, any>;
  try {
    packageJson = JSON.parse(packageJsonStr);
  } catch (error) {
    console.error('Error: Failed to parse package.json as valid JSON.');
    process.exit(1);
  }

  const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  let hasUpdates = false;

  for (const depType of dependencyTypes) {
    if (packageJson[depType] && typeof packageJson[depType] === 'object') {
      console.log(`\nChecking ${depType}...`);
      for (const pkg of Object.keys(packageJson[depType])) {
        const currentVersion = packageJson[depType][pkg];

        // Skip packages with local paths, URLs, or workspace protocols
        if (
          currentVersion.startsWith('workspace:') ||
          currentVersion.startsWith('file:') ||
          currentVersion.startsWith('link:') ||
          currentVersion.startsWith('git') ||
          currentVersion.includes('://')
        ) {
          console.log(`  Skipping ${pkg} (non-registry version: ${currentVersion})`);
          continue;
        }

        const latestVersion = getLatestVersion(pkg);
        if (latestVersion) {
          // Preserve the prefix (^ or ~), defaulting to ^ if none matches but it was a clear version
          const prefixMatch = currentVersion.match(/^[\^\~\>\<\=\*]*/);
          const prefix = prefixMatch && prefixMatch[0] !== '' && prefixMatch[0] !== '*' ? prefixMatch[0] : '^';

          let newVersion = `${prefix}${latestVersion}`;
          if (currentVersion === '*' || currentVersion === 'latest') {
            newVersion = latestVersion; // Just keep it exact or handle gracefully if desired
          }

          if (currentVersion !== newVersion) {
            console.log(`  Upgrading ${pkg}: ${currentVersion} -> ${newVersion}`);
            packageJson[depType][pkg] = newVersion;
            hasUpdates = true;
          } else {
            console.log(`  ${pkg} is up to date (${currentVersion})`);
          }
        }
      }
    }
  }

  console.log('\nSorting all keys in package.json...');
  const sortedPackageJson = sortKeys(packageJson);

  fs.writeFileSync(packageJsonPath, JSON.stringify(sortedPackageJson, null, 2) + '\n', 'utf-8');
  console.log(!hasUpdates ? '\nNo dependencies needed updating.' : '\npackage.json updated successfully.');
}

main();
