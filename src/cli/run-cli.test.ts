import { describe, expect, it, vi } from 'vitest';
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
  it('prints help and exits with an error for invalid arguments', async () => {
    vi.mocked(runUpgradeCommand).mockRejectedValueOnce(new CliUsageError('Unexpected argument: --unknown'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);

    try {
      await expect(runCli()).rejects.toThrow('process.exit: 1');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(logger.error).toHaveBeenCalledWith('Unexpected argument: --unknown');
      expect(logger.info).toHaveBeenCalledWith(getHelpMessage());
    } finally {
      exitSpy.mockRestore();
    }
  });
});
