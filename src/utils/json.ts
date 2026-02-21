export const stringify = (object: any): string => {
  const allKeys = new Set<string>();
  const collectKeys = (obj: any) => {
    const shouldCollectKeys = !Array.isArray(obj);
    for (const key of Object.keys(obj)) {
      if (shouldCollectKeys) {
        allKeys.add(key);
      }
      if (null !== obj[key] && typeof obj[key] === 'object') {
        collectKeys(obj[key]);
      }
    }
  };
  collectKeys(object);
  return JSON.stringify(object, Array.from(allKeys).sort(), 2);
};
