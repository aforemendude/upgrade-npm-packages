import * as fs from 'fs/promises';
import { createCachedNpmRegistry, type NpmRegistry } from '../npm/npm-registry';
import { logger } from '../utils/logger';
import { stringifyJsonWithSortedKeys } from '../utils/stringify-json';
import type { DependencySection } from './upgrade-dependency-section';
import { upgradeDependencySection } from './upgrade-dependency-section';

type PackageJson = Record<string, unknown> & {
  dependencies?: DependencySection;
  devDependencies?: DependencySection;
};

export const upgradePackageJson = async (
  filePath: string,
  npmRegistry: NpmRegistry = createCachedNpmRegistry(),
): Promise<void> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const packageJson = JSON.parse(content) as PackageJson;

    await upgradeDependencySection(packageJson.dependencies, npmRegistry);
    await upgradeDependencySection(packageJson.devDependencies, npmRegistry);

    const formattedJson = stringifyJsonWithSortedKeys(packageJson);
    await fs.writeFile(filePath, formattedJson, 'utf-8');
    logger.success(`Successfully upgraded packages in ${filePath}`);
  } catch (error) {
    logger.error(`Unable to process ${filePath}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
};
