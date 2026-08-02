import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPackages } from './install-packages';
import { runNpmCommand } from './run-npm-command';

vi.mock('./run-npm-command', () => ({
  runNpmCommand: vi.fn(),
}));

describe('installPackages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runNpmCommand).mockResolvedValue({ stderr: '', stdout: '' });
  });

  it('runs npm install once in the requested working directory', async () => {
    await installPackages('/repo');

    expect(runNpmCommand).toHaveBeenCalledTimes(1);
    expect(runNpmCommand).toHaveBeenCalledWith(['install'], { cwd: '/repo' });
  });

  it('propagates an npm install failure', async () => {
    const installError = new Error('npm install failed');
    vi.mocked(runNpmCommand).mockRejectedValueOnce(installError);

    await expect(installPackages('/repo')).rejects.toBe(installError);
  });
});
