import * as fs from 'fs/promises';
import * as path from 'path';
import { coerce, minVersion, parse, validRange } from 'semver';
import { SAME_MAJOR_UPGRADE_PACKAGES } from './config';
import { stringify } from './utils/json';
import { getLatestVersion, getLatestVersionOfMajor, installPackages } from './utils/npm';
import { logger } from './utils/logger';

type ReinstallTargets = {
  lockfilePaths: string[];
  nodeModulesPaths: string[];
};

type DependencyTarget = {
  packageName: string;
  versionRef: string | undefined;
  formatVersion: (version: string) => string;
};

const PACKAGE_LOCK_FILE = 'package-lock.json';
const NODE_MODULES_DIRECTORY = 'node_modules';
const NPM_ALIAS_PATTERN = /^npm:((?:@[^/\s]+\/)?[^@/\s]+)(?:@(.+))?$/;

const getDependencyTarget = (packageName: string, versionRef: string): DependencyTarget => {
  const aliasMatch = versionRef.match(NPM_ALIAS_PATTERN);
  const targetPackageName = aliasMatch?.[1];

  if (!targetPackageName) {
    return {
      packageName,
      versionRef,
      formatVersion: (version) => version,
    };
  }

  return {
    packageName: targetPackageName,
    versionRef: aliasMatch[2],
    formatVersion: (version) => `npm:${targetPackageName}@${version}`,
  };
};

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

    const target = getDependencyTarget(pkg, currentRef);

    if (target.versionRef === '*') {
      logger.warn(`Skipping ${pkg} as it has '*' version`);
      continue;
    }

    const currentVersion = target.versionRef ? extractVersion(target.versionRef) : undefined;
    const currentVersionReference = currentVersion ?? target.versionRef;
    const currentMajor = target.versionRef ? getMajorVersion(target.versionRef) : null;

    let latestVersion = '';

    if (SAME_MAJOR_UPGRADE_PACKAGES.has(target.packageName) && currentMajor !== null) {
      latestVersion = await getLatestVersionOfMajor(target.packageName, currentMajor, currentVersionReference);
    } else {
      latestVersion = await getLatestVersion(target.packageName, currentVersionReference);
    }

    if (latestVersion) {
      section[pkg] = target.formatVersion(latestVersion);
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
  } catch (error) {
    logger.error(`Unable to process ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
};

const collectReinstallTargets = async (dir: string, targets: ReinstallTargets): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === NODE_MODULES_DIRECTORY) {
        targets.nodeModulesPaths.push(fullPath);
        continue;
      }

      await collectReinstallTargets(fullPath, targets);
      continue;
    }

    if (entry.name === PACKAGE_LOCK_FILE) {
      targets.lockfilePaths.push(fullPath);
    }
  }
};

export const forceReinstall = async (cwd: string): Promise<void> => {
  const targets: ReinstallTargets = {
    lockfilePaths: [],
    nodeModulesPaths: [],
  };

  await collectReinstallTargets(cwd, targets);
  targets.lockfilePaths.sort();
  targets.nodeModulesPaths.sort();

  for (const lockfilePath of targets.lockfilePaths) {
    await fs.rm(lockfilePath, { force: true });
    logger.info(`Deleted ${lockfilePath}`);
  }

  for (const nodeModulesPath of targets.nodeModulesPaths) {
    await fs.rm(nodeModulesPath, { recursive: true, force: true });
    logger.info(`Deleted ${nodeModulesPath}`);
  }

  logger.info(`Running npm install in ${cwd}...`);
  await installPackages(cwd);

  logger.success(`Successfully reinstalled dependencies in ${cwd}`);
};
