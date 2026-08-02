type SortContext = 'regular' | 'exports' | 'imports' | 'conditions';

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

const sortJsonValue = (value: unknown, context: SortContext, isRoot: boolean): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item, context, false));
  }

  if (!isObject(value)) {
    return value;
  }

  const keys = Object.keys(value);
  const isConditionalExportsObject = context === 'exports' && keys.every((key) => !key.startsWith('.'));
  const preserveKeyOrder = context === 'conditions' || isConditionalExportsObject;
  const orderedKeys = preserveKeyOrder ? keys : [...keys].sort();

  const sortedValue = Object.fromEntries(
    orderedKeys.map((key) => {
      let nestedContext: SortContext = 'regular';

      if (isRoot && key === 'exports') {
        nestedContext = 'exports';
      } else if (isRoot && key === 'imports') {
        nestedContext = 'imports';
      } else if (context === 'exports' || context === 'imports' || context === 'conditions') {
        nestedContext = 'conditions';
      }

      return [key, sortJsonValue(value[key], nestedContext, false)];
    }),
  );

  // JSON.stringify otherwise promotes integer-index keys ahead of the requested lexicographic order.
  return new Proxy(sortedValue, {
    ownKeys: () => orderedKeys,
  });
};

export const stringifyJsonWithSortedKeys = (value: unknown): string => {
  return JSON.stringify(sortJsonValue(value, 'regular', true), null, 2);
};
