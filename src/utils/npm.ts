import spawn from 'cross-spawn';
import { ExecFileOptions } from 'child_process';
import logger from './logger';

const runNpm = (args: string[], options: ExecFileOptions = {}): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => {
      stdout += data;
    });
    child.stderr?.on('data', (data) => {
      stderr += data;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm ${args[0]} exited with code ${code}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

export const getLatestVersion = async (packageName: string): Promise<string> => {
  try {
    const { stdout } = await runNpm(['view', packageName, 'version']);
    return stdout.toString().trim() || '';
  } catch (error) {
    logger.error(`Could not fetch the latest version for ${packageName}. Skipping...`);
    return '';
  }
};

export const getLatestVersionOfMajor = async (packageName: string, major: number): Promise<string> => {
  try {
    const { stdout } = await runNpm(['view', `${packageName}@${major}`, 'version', '--json']);
    const versions = JSON.parse(stdout.toString() || '""');
    if (Array.isArray(versions)) {
      return versions[versions.length - 1] || '';
    }
    return typeof versions === 'string' ? versions : '';
  } catch (error) {
    logger.error(`Could not fetch versions for ${packageName}@${major}. Skipping...`);
    return '';
  }
};

export const installPackages = async (cwd: string): Promise<void> => {
  await runNpm(['install'], { cwd });
};
