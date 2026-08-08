import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCachedNpmRegistry,
  getPackageVersionMetadata,
  isPackageVersionDeprecated,
  type NpmRegistry,
} from './npm-registry';
import { runNpmCommand } from './run-npm-command';

vi.mock('./run-npm-command', () => ({
  runNpmCommand: vi.fn(),
}));

describe('npm-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPackageVersionMetadata', () => {
    it('returns string versions and version times from registry metadata', async () => {
      vi.mocked(runNpmCommand).mockResolvedValueOnce({
        stderr: '',
        stdout: JSON.stringify({
          time: {
            '1.0.0': '2025-01-01T00:00:00.000Z',
            '2.0.0': '2025-02-01T00:00:00.000Z',
          },
          versions: ['1.0.0', 17, null, '2.0.0'],
        }),
      });

      await expect(getPackageVersionMetadata('@scope/package')).resolves.toEqual({
        versions: ['1.0.0', '2.0.0'],
        versionTimes: {
          '1.0.0': '2025-01-01T00:00:00.000Z',
          '2.0.0': '2025-02-01T00:00:00.000Z',
        },
      });
      expect(runNpmCommand).toHaveBeenCalledTimes(1);
      expect(runNpmCommand).toHaveBeenCalledWith(['view', '@scope/package', 'versions', 'time', '--json']);
    });

    it('normalizes a single version and invalid version-time metadata', async () => {
      vi.mocked(runNpmCommand).mockResolvedValueOnce({
        stderr: '',
        stdout: JSON.stringify({ time: [], versions: '1.0.0' }),
      });

      await expect(getPackageVersionMetadata('package')).resolves.toEqual({
        versions: ['1.0.0'],
        versionTimes: {},
      });
    });

    it.each(['', 'undefined', 'null', '[]', '"invalid"'])('returns empty metadata for %p', async (stdout) => {
      vi.mocked(runNpmCommand).mockResolvedValueOnce({ stderr: '', stdout });

      await expect(getPackageVersionMetadata('package')).resolves.toEqual({
        versions: [],
        versionTimes: {},
      });
    });

    it('propagates an npm command failure', async () => {
      const commandError = new Error('registry unavailable');
      vi.mocked(runNpmCommand).mockRejectedValueOnce(commandError);

      await expect(getPackageVersionMetadata('package')).rejects.toBe(commandError);
    });
  });

  describe('isPackageVersionDeprecated', () => {
    it('reports a non-empty deprecation message as deprecated', async () => {
      vi.mocked(runNpmCommand).mockResolvedValueOnce({ stderr: '', stdout: '"Use 2.x instead"\n' });

      await expect(isPackageVersionDeprecated('@scope/package', '1.0.0')).resolves.toBe(true);
      expect(runNpmCommand).toHaveBeenCalledTimes(1);
      expect(runNpmCommand).toHaveBeenCalledWith(['view', '@scope/package@1.0.0', 'deprecated', '--json']);
    });

    it.each(['', 'undefined', '""', 'false'])('reports %p as not deprecated', async (stdout) => {
      vi.mocked(runNpmCommand).mockResolvedValueOnce({ stderr: '', stdout });

      await expect(isPackageVersionDeprecated('package', '1.0.0')).resolves.toBe(false);
    });
  });

  describe('createCachedNpmRegistry', () => {
    const metadata = {
      versions: ['1.0.0'],
      versionTimes: { '1.0.0': '2025-01-01T00:00:00.000Z' },
    };

    const createRegistry = (): NpmRegistry => ({
      getPackageVersionMetadata: vi.fn().mockResolvedValue(metadata),
      isPackageVersionDeprecated: vi.fn().mockResolvedValue(false),
    });

    it('reuses in-flight and completed package metadata requests by package name', async () => {
      const registry = createRegistry();
      const cachedRegistry = createCachedNpmRegistry(registry);

      const firstRequest = cachedRegistry.getPackageVersionMetadata('package');
      const secondRequest = cachedRegistry.getPackageVersionMetadata('package');

      expect(secondRequest).toBe(firstRequest);
      await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([metadata, metadata]);
      await expect(cachedRegistry.getPackageVersionMetadata('package')).resolves.toBe(metadata);
      await expect(cachedRegistry.getPackageVersionMetadata('other-package')).resolves.toBe(metadata);
      expect(registry.getPackageVersionMetadata).toHaveBeenCalledTimes(2);
      expect(registry.getPackageVersionMetadata).toHaveBeenNthCalledWith(1, 'package');
      expect(registry.getPackageVersionMetadata).toHaveBeenNthCalledWith(2, 'other-package');
    });

    it('keys deprecation requests by both package name and version', async () => {
      const registry = createRegistry();
      const cachedRegistry = createCachedNpmRegistry(registry);

      const firstRequest = cachedRegistry.isPackageVersionDeprecated('package', '1.0.0');
      const secondRequest = cachedRegistry.isPackageVersionDeprecated('package', '1.0.0');

      expect(secondRequest).toBe(firstRequest);
      await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([false, false]);
      await expect(cachedRegistry.isPackageVersionDeprecated('package', '1.0.0')).resolves.toBe(false);
      await expect(cachedRegistry.isPackageVersionDeprecated('package', '2.0.0')).resolves.toBe(false);
      await expect(cachedRegistry.isPackageVersionDeprecated('other-package', '1.0.0')).resolves.toBe(false);
      expect(registry.isPackageVersionDeprecated).toHaveBeenCalledTimes(3);
      expect(vi.mocked(registry.isPackageVersionDeprecated).mock.calls).toEqual([
        ['package', '1.0.0'],
        ['package', '2.0.0'],
        ['other-package', '1.0.0'],
      ]);
    });

    it('removes failed requests so a later occurrence can retry', async () => {
      const registryError = new Error('registry unavailable');
      const registry = createRegistry();
      vi.mocked(registry.getPackageVersionMetadata)
        .mockRejectedValueOnce(registryError)
        .mockResolvedValueOnce(metadata);
      const cachedRegistry = createCachedNpmRegistry(registry);

      await expect(cachedRegistry.getPackageVersionMetadata('package')).rejects.toBe(registryError);
      await expect(cachedRegistry.getPackageVersionMetadata('package')).resolves.toBe(metadata);
      expect(registry.getPackageVersionMetadata).toHaveBeenCalledTimes(2);
    });

    it('does not share entries between cache instances', async () => {
      const registry = createRegistry();

      await createCachedNpmRegistry(registry).getPackageVersionMetadata('package');
      await createCachedNpmRegistry(registry).getPackageVersionMetadata('package');

      expect(registry.getPackageVersionMetadata).toHaveBeenCalledTimes(2);
    });
  });
});
