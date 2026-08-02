import type { ExecFileOptions } from 'child_process';
import spawn from 'cross-spawn';

export type NpmCommandResult = {
  stderr: string;
  stdout: string;
};

export const runNpmCommand = (args: string[], options: ExecFileOptions = {}): Promise<NpmCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn('npm', args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += String(data);
    });
    child.stderr?.on('data', (data) => {
      stderr += String(data);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm ${args[0]} exited with code ${code}\n${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
