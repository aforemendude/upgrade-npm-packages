import { parseNpmJsonOutput } from './parse-npm-json-output';
import { runNpmCommand } from './run-npm-command';

export type PackageVersionTimes = Record<string, string>;

export type PackageVersionMetadata = {
  versions: string[];
  versionTimes: PackageVersionTimes;
};

const normalizeVersions = (versions: unknown): string[] => {
  if (Array.isArray(versions)) {
    return versions.filter((version): version is string => typeof version === 'string');
  }

  return typeof versions === 'string' && versions ? [versions] : [];
};

const normalizeVersionTimes = (versionTimes: unknown): PackageVersionTimes => {
  if (!versionTimes || typeof versionTimes !== 'object' || Array.isArray(versionTimes)) {
    return {};
  }

  return versionTimes as PackageVersionTimes;
};

export const getPackageVersionMetadata = async (packageName: string): Promise<PackageVersionMetadata> => {
  const { stdout } = await runNpmCommand(['view', packageName, 'versions', 'time', '--json']);

  const metadata = parseNpmJsonOutput(stdout, {});
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { versions: [], versionTimes: {} };
  }

  const { versions, time } = metadata as {
    versions?: unknown;
    time?: unknown;
  };

  return {
    versions: normalizeVersions(versions),
    versionTimes: normalizeVersionTimes(time),
  };
};

export const isPackageVersionDeprecated = async (packageName: string, version: string): Promise<boolean> => {
  const { stdout } = await runNpmCommand(['view', `${packageName}@${version}`, 'deprecated', '--json']);
  const deprecationMessage = parseNpmJsonOutput(stdout, '');
  return typeof deprecationMessage === 'string' && deprecationMessage.length > 0;
};
