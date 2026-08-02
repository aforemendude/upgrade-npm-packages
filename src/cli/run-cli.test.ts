import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../utils/logger';
import { getHelpMessage } from './get-help-message';
import { CliUsageError } from './parse-cli-arguments';
import { runCli } from './run-cli';
import { runUpgradeCommand } from './run-upgrade-command';

vi.mock('./run-upgrade-command', () => ({
  runUpgradeCommand: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('runCli', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'upgrade-npm-packages', '--force-reinstall'];
    vi.spyOn(process, 'cwd').mockReturnValue('/repo');
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('runs the upgrade command with process arguments and the current directory', async () => {
    vi.mocked(runUpgradeCommand).mockResolvedValueOnce(undefined);

    await runCli();

    expect(runUpgradeCommand).toHaveBeenCalledTimes(1);
    expect(runUpgradeCommand).toHaveBeenCalledWith({
      args: ['--force-reinstall'],
      workingDirectory: '/repo',
    });
    expect(process.exit).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('prints help and exits with an error for invalid arguments', async () => {
    vi.mocked(runUpgradeCommand).mockRejectedValueOnce(new CliUsageError('Unexpected argument: --unknown'));

    await expect(runCli()).rejects.toThrow('process.exit: 1');
    expect(process.exit).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('Unexpected argument: --unknown');
    expect(logger.info).toHaveBeenCalledWith(getHelpMessage());
  });

  it.each([
    [new Error('registry unavailable'), 'registry unavailable'],
    ['registry unavailable', 'registry unavailable'],
  ])('reports an unhandled rejection and exits for %p', async (error, expectedMessage) => {
    vi.mocked(runUpgradeCommand).mockRejectedValueOnce(error);

    await expect(runCli()).rejects.toThrow('process.exit: 1');
    expect(process.exit).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('Unhandled error:', expectedMessage);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
