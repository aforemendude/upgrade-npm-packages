export const parseNpmJsonOutput = (output: string, fallback: unknown): unknown => {
  const trimmedOutput = output.trim();
  if (!trimmedOutput || trimmedOutput === 'undefined') {
    return fallback;
  }

  return JSON.parse(trimmedOutput) as unknown;
};
