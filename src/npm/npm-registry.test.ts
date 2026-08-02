import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackageVersionMetadata, isPackageVersionDeprecated } from './npm-registry';
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
});
