import { parseNpmJsonOutput } from './parse-npm-json-output';
import { runNpmCommand } from './run-npm-command';

export type PackageVersionTimes = Record<string, string>;

export type PackageVersionMetadata = {
  versions: string[];
  versionTimes: PackageVersionTimes;
};

export type NpmRegistry = {
  getPackageVersionMetadata: (packageName: string) => Promise<PackageVersionMetadata>;
  isPackageVersionDeprecated: (packageName: string, version: string) => Promise<boolean>;
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

export const uncachedNpmRegistry: NpmRegistry = {
  getPackageVersionMetadata,
  isPackageVersionDeprecated,
};

const getCachedPromise = <Key, Value>(
  cache: Map<Key, Promise<Value>>,
  key: Key,
  loadValue: () => Promise<Value>,
): Promise<Value> => {
  const cachedPromise = cache.get(key);
  if (cachedPromise) {
    return cachedPromise;
  }

  const request = Promise.resolve().then(loadValue);
  cache.set(key, request);
  void request.catch(() => {
    if (cache.get(key) === request) {
      cache.delete(key);
    }
  });
  return request;
};

export const createCachedNpmRegistry = (registry: NpmRegistry = uncachedNpmRegistry): NpmRegistry => {
  const packageMetadata = new Map<string, Promise<PackageVersionMetadata>>();
  const packageVersionDeprecations = new Map<string, Map<string, Promise<boolean>>>();

  return {
    getPackageVersionMetadata: (packageName) =>
      getCachedPromise(packageMetadata, packageName, () => registry.getPackageVersionMetadata(packageName)),
    isPackageVersionDeprecated: (packageName, version) => {
      let versionDeprecations = packageVersionDeprecations.get(packageName);
      if (!versionDeprecations) {
        versionDeprecations = new Map<string, Promise<boolean>>();
        packageVersionDeprecations.set(packageName, versionDeprecations);
      }

      return getCachedPromise(versionDeprecations, version, () =>
        registry.isPackageVersionDeprecated(packageName, version),
      );
    },
  };
};
