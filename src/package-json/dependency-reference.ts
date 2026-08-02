import { coerce, minVersion, parse, validRange } from 'semver';

const NPM_ALIAS_PATTERN = /^npm:((?:@[^/\s]+\/)?[^@/\s]+)(?:@(.+))?$/;

export type DependencyUpgradeTarget = {
  formatVersion: (version: string) => string;
  packageName: string;
  versionReference: string | undefined;
};

export const resolveDependencyUpgradeTarget = (
  packageName: string,
  versionReference: string,
): DependencyUpgradeTarget => {
  const aliasMatch = versionReference.match(NPM_ALIAS_PATTERN);
  const targetPackageName = aliasMatch?.[1];

  if (!targetPackageName) {
    return {
      formatVersion: (version) => version,
      packageName,
      versionReference,
    };
  }

  return {
    formatVersion: (version) => `npm:${targetPackageName}@${version}`,
    packageName: targetPackageName,
    versionReference: aliasMatch[2],
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
  const exactVersion = extractVersionFromReference(versionReference);
  if (exactVersion) {
    return parse(exactVersion)?.major ?? null;
  }

  if (!validRange(versionReference)) {
    return null;
  }

  return minVersion(versionReference)?.major ?? null;
};
