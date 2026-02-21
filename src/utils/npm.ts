import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const getLatestVersion = async (
  packageName: string,
): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('npm', [
      'view',
      packageName,
      'version',
    ]);
    return stdout.trim();
  } catch (error) {
    console.warn(
      `Could not fetch the latest version for ${packageName}. Skipping...`,
    );
    return '';
  }
};

export const getLatestVersionOfMajor = async (
  packageName: string,
  major: number,
): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('npm', [
      'view',
      `${packageName}@${major}`,
      'version',
      '--json',
    ]);
    const versions = JSON.parse(stdout);
    if (Array.isArray(versions)) {
      return versions[versions.length - 1] || '';
    }
    return typeof versions === 'string' ? versions : '';
  } catch (error) {
    console.warn(
      `Could not fetch versions for ${packageName}@${major}. Skipping...`,
    );
    return '';
  }
};
