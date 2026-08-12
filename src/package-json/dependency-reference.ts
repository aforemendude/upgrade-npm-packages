import npmPackageArg from 'npm-package-arg';
import { coerce, minVersion, parse, subset, validRange } from 'semver';

export type DependencyUpgradeTarget = {
  formatVersion: (version: string) => string;
  packageName: string;
  versionReference: string | undefined;
};

const isUpgradeableRegistryReference = (result: npmPackageArg.Result): result is npmPackageArg.RegistryResult =>
  result.registry && (result.type === 'version' || result.type === 'range' || result.type === 'tag');

export const resolveDependencyUpgradeTarget = (
  packageName: string,
  versionReference: string,
): DependencyUpgradeTarget | undefined => {
  let parsedReference: ReturnType<typeof npmPackageArg.resolve>;

  try {
    parsedReference = npmPackageArg.resolve(packageName, versionReference);
  } catch {
    return undefined;
  }

  if (isUpgradeableRegistryReference(parsedReference)) {
    return {
      formatVersion: (version) => version,
      packageName,
      versionReference,
    };
  }

  if (parsedReference.type !== 'alias' || !isUpgradeableRegistryReference(parsedReference.subSpec)) {
    return undefined;
  }

  const targetPackageName = parsedReference.subSpec.name;
  if (!targetPackageName) {
    return undefined;
  }

  return {
    formatVersion: (version) => `npm:${targetPackageName}@${version}`,
    packageName: targetPackageName,
    versionReference: versionReference === `npm:${targetPackageName}` ? undefined : parsedReference.subSpec.rawSpec,
  };
};

export const extractVersionFromReference = (versionReference: string): string | undefined => {
  const version = coerce(versionReference, { includePrerelease: true });
  if (!version || !versionReference.includes(version.raw)) {
    return undefined;
  }

  return version.raw;
};

export const getMajorVersionFromReference = (versionReference: string): number | null => {
  if (!validRange(versionReference)) {
    const exactVersion = extractVersionFromReference(versionReference);
    return exactVersion ? (parse(exactVersion)?.major ?? null) : null;
  }

  const minimumVersion = minVersion(versionReference);
  if (!minimumVersion || !subset(versionReference, `${minimumVersion.major}.x`, { includePrerelease: true })) {
    return null;
  }

  return minimumVersion.major;
};
