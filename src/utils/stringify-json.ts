export const stringifyJsonWithSortedKeys = (value: unknown): string => {
  const keys = new Set<string>();

  const collectObjectKeys = (currentValue: unknown): void => {
    if (currentValue === null || typeof currentValue !== 'object') {
      return;
    }

    const objectValue = currentValue as Record<string, unknown>;
    if (!Array.isArray(currentValue)) {
      for (const key of Object.keys(objectValue)) {
        keys.add(key);
      }
    }

    for (const nestedValue of Object.values(objectValue)) {
      collectObjectKeys(nestedValue);
    }
  };

  collectObjectKeys(value);
  return JSON.stringify(value, [...keys].sort(), 2);
};
