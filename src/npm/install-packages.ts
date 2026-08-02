import { runNpmCommand } from './run-npm-command';

export const installPackages = async (workingDirectory: string): Promise<void> => {
  await runNpmCommand(['install'], { cwd: workingDirectory });
};
