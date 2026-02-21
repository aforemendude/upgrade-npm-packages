import { execFile } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';

const NPM_COMMAND = platform() === 'win32' ? 'npm.cmd' : 'npm';

const execFileAsync = promisify(execFile);
export const getLatestVersion = async (packageName: string): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(NPM_COMMAND, ['view', packageName, 'version']);
    return stdout.trim();
  } catch (error) {
    console.warn(`Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
};

export const getLatestVersionOfMajor = async (packageName: string, major: number): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(NPM_COMMAND, ['view', `${packageName}@${major}`, 'version', '--json']);
    const versions = JSON.parse(stdout);
    if (Array.isArray(versions)) {
      return versions[versions.length - 1] || '';
    }
    return typeof versions === 'string' ? versions : '';
  } catch (error) {
    console.warn(`Could not fetch versions for ${packageName}@${major}. Skipping...`);
    return '';
  }
};

export const installPackages = async (cwd: string): Promise<void> => {
  await execFileAsync(NPM_COMMAND, ['install'], { cwd });
};
