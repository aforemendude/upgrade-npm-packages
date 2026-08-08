import { EventEmitter } from 'events';
import spawn from 'cross-spawn';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitWorktreeSafetyError, requireCleanGitWorktree } from './require-clean-git-worktree';

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}));

type MockChild = EventEmitter & {
  stderr?: EventEmitter;
  stdout?: EventEmitter;
};

const createMockChild = (): MockChild => {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
};

describe('requireCleanGitWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a clean Git worktree', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = requireCleanGitWorktree('/repo');
    child.emit('close', 0);

    await expect(result).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'],
      {
        cwd: '/repo',
        shell: false,
      },
    );
  });

  it('rejects a worktree with tracked or untracked changes', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = requireCleanGitWorktree('/repo');
    child.stdout?.emit('data', ' M package.json\n?? scratch.txt\n');
    child.emit('close', 0);

    await expect(result).rejects.toMatchObject({
      name: GitWorktreeSafetyError.name,
      message:
        'Refusing to upgrade because the Git worktree has uncommitted changes. ' +
        'Commit or stash them first, or pass --allow-dirty to bypass this check.',
    });
  });

  it('rejects when the current directory is not in a Git worktree', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = requireCleanGitWorktree('/repo');
    child.stderr?.emit('data', 'fatal: not a git repository');
    child.emit('close', 128);

    await expect(result).rejects.toMatchObject({
      name: GitWorktreeSafetyError.name,
      message:
        'Unable to check the Git worktree in /repo: fatal: not a git repository ' +
        'Run the command inside a Git worktree, or pass --allow-dirty to bypass this check.',
    });
  });

  it('rejects when Git cannot be started', async () => {
    const child = createMockChild();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const result = requireCleanGitWorktree('/repo');
    child.emit('error', new Error('spawn git ENOENT'));

    await expect(result).rejects.toMatchObject({
      name: GitWorktreeSafetyError.name,
      message:
        'Unable to check the Git worktree in /repo: spawn git ENOENT. ' +
        'Run the command inside a Git worktree with Git installed, or pass --allow-dirty to bypass this check.',
    });
  });
});
