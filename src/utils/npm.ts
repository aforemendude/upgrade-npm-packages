import { execFile, ExecFileOptions } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const execNpm = async (args: string[], options: ExecFileOptions = {}) => {
  const isWin = platform() === 'win32';
  return execFileAsync(isWin ? 'npm.cmd' : 'npm', args, {
    ...options,
    shell: isWin ? true : options.shell,
  });
};

export const getLatestVersion = async (packageName: string): Promise<string> => {
  try {
    const { stdout } = await execNpm(['view', packageName, 'version']);
    return stdout.toString().trim() || '';
  } catch (error) {
    console.error(`ERROR: Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
};

export const getLatestVersionOfMajor = async (packageName: string, major: number): Promise<string> => {
  try {
    const { stdout } = await execNpm(['view', `${packageName}@${major}`, 'version', '--json']);
    const versions = JSON.parse(stdout.toString() || '""');
    if (Array.isArray(versions)) {
      return versions[versions.length - 1] || '';
    }
    return typeof versions === 'string' ? versions : '';
  } catch (error) {
    console.error(`ERROR: Could not fetch versions for ${packageName}@${major}. Skipping...`);
    return '';
  }
};

export const installPackages = async (cwd: string): Promise<void> => {
  await execNpm(['install'], { cwd });
};
