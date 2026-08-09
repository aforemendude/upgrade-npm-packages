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
    child.on('close', (code, signal) => {
      if (code !== 0) {
        let outcome: string;
        if (signal) {
          outcome = `was terminated by signal ${signal}`;
        } else if (code === null) {
          outcome = 'ended without reporting an exit code';
        } else {
          outcome = `exited with code ${code}`;
        }
        reject(new Error(`npm ${args[0]} ${outcome}${stderr.length > 0 ? `\n${stderr}` : ''}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
