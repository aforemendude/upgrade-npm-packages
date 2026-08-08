import spawn from 'cross-spawn';

const GIT_STATUS_ARGUMENTS = ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'] as const;

export class GitWorktreeSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitWorktreeSafetyError';
  }
}

const getGitStatus = (workingDirectory: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn('git', [...GIT_STATUS_ARGUMENTS], {
      cwd: workingDirectory,
      shell: false,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += String(data);
    });
    child.stderr?.on('data', (data) => {
      stderr += String(data);
    });
    child.on('error', (error) => {
      reject(
        new GitWorktreeSafetyError(
          `Unable to check the Git worktree in ${workingDirectory}: ${error.message}. ` +
            'Run the command inside a Git worktree with Git installed, or pass --allow-dirty to bypass this check.',
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = stderr.trim();
        reject(
          new GitWorktreeSafetyError(
            `Unable to check the Git worktree in ${workingDirectory}${detail.length > 0 ? `: ${detail}` : '.'} ` +
              'Run the command inside a Git worktree, or pass --allow-dirty to bypass this check.',
          ),
        );
        return;
      }

      resolve(stdout);
    });
  });

export const requireCleanGitWorktree = async (workingDirectory: string): Promise<void> => {
  const status = await getGitStatus(workingDirectory);
  if (status.length > 0) {
    throw new GitWorktreeSafetyError(
      'Refusing to upgrade because the Git worktree has uncommitted changes. ' +
        'Commit or stash them first, or pass --allow-dirty to bypass this check.',
    );
  }
};
