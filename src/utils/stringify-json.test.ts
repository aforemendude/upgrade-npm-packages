import { describe, it, expect } from 'vitest';
import { stringifyJsonWithSortedKeys } from './stringify-json';

describe('stringifyJsonWithSortedKeys', () => {
  it('should sort simple object keys alphabetically', () => {
    const obj = { c: 3, a: 1, b: 2 };
    const result = stringifyJsonWithSortedKeys(obj);
    const expected = JSON.stringify({ a: 1, b: 2, c: 3 }, null, 2);
    expect(result).toBe(expected);
  });

  it('should sort nested object keys recursively', () => {
    const obj = {
      z: 1,
      a: {
        y: 2,
        b: 3,
      },
    };
    const result = stringifyJsonWithSortedKeys(obj);
    // Expected order: a, a.b, a.y, z
    const expected = JSON.stringify(
      {
        a: {
          b: 3,
          y: 2,
        },
        z: 1,
      },
      ['a', 'b', 'y', 'z'],
      2,
    );
    expect(result).toBe(expected);
  });

  it('should NOT sort array elements but sort object keys inside arrays', () => {
    const obj = {
      list: [
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ],
    };
    const result = stringifyJsonWithSortedKeys(obj);
    const expected = JSON.stringify(obj, ['a', 'b', 'c', 'd', 'list'], 2);

    expect(result).toBe(expected);
  });

  it('should handle null values correctly', () => {
    const obj = { b: null, a: 1 };
    const result = stringifyJsonWithSortedKeys(obj);
    expect(result).toBe(JSON.stringify({ a: 1, b: null }, ['a', 'b'], 2));
  });

  it('should handle overlapping keys at different levels', () => {
    const obj = {
      b: { a: 1 },
      a: 2,
    };
    const result = stringifyJsonWithSortedKeys(obj);
    // allKeys = ['b', 'a'] sorted = ['a', 'b']
    const expected = JSON.stringify({ a: 2, b: { a: 1 } }, ['a', 'b'], 2);
    expect(result).toBe(expected);
  });

  it('does not mutate the original object while sorting its serialized keys', () => {
    const obj = { c: 3, a: 1, b: 2 };

    stringifyJsonWithSortedKeys(obj);

    expect(Object.keys(obj)).toEqual(['c', 'a', 'b']);
  });

  it('serializes the original object instead of a clone', () => {
    let receiver: unknown;
    const obj = {
      b: 2,
      a: 1,
      toJSON() {
        receiver = this;
        return { b: this.b, a: this.a };
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(JSON.stringify({ a: 1, b: 2 }, null, 2));
    expect(receiver).toBe(obj);
  });

  it('sorts frozen objects without violating Proxy invariants', () => {
    const obj = Object.freeze({
      z: Object.freeze({ b: 2, a: 1 }),
      a: 0,
    });

    expect(stringifyJsonWithSortedKeys(obj)).toBe(
      JSON.stringify(
        {
          a: 0,
          z: { a: 1, b: 2 },
        },
        null,
        2,
      ),
    );
  });

  it('preserves circular reference detection', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;

    expect(() => stringifyJsonWithSortedKeys(obj)).toThrow(TypeError);
  });

  it('sorts export subpaths while preserving nested conditional export key order', () => {
    const obj = {
      exports: {
        './feature': {
          node: {
            require: './feature-node.cjs',
            import: './feature-node.js',
            default: './feature-node-fallback.js',
          },
          default: './feature.js',
        },
        '.': {
          import: './index.js',
          require: './index.cjs',
          default: './index-fallback.js',
        },
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(
      JSON.stringify(
        {
          exports: {
            '.': {
              import: './index.js',
              require: './index.cjs',
              default: './index-fallback.js',
            },
            './feature': {
              node: {
                require: './feature-node.cjs',
                import: './feature-node.js',
                default: './feature-node-fallback.js',
              },
              default: './feature.js',
            },
          },
        },
        null,
        2,
      ),
    );
  });

  it('preserves top-level conditional export key order', () => {
    const obj = {
      exports: {
        node: './index-node.js',
        import: './index.js',
        default: './index-fallback.js',
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(JSON.stringify(obj, null, 2));
  });

  it('sorts import specifiers while preserving conditional import key order', () => {
    const obj = {
      imports: {
        '#utilities': {
          node: '#utilities-node',
          default: '#utilities-fallback',
        },
        '#constants': {
          development: '#constants-development',
          default: '#constants-production',
        },
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(
      JSON.stringify(
        {
          imports: {
            '#constants': {
              development: '#constants-development',
              default: '#constants-production',
            },
            '#utilities': {
              node: '#utilities-node',
              default: '#utilities-fallback',
            },
          },
        },
        null,
        2,
      ),
    );
  });

  it('continues sorting condition-like keys outside exports and imports', () => {
    const obj = {
      metadata: {
        node: true,
        import: true,
        default: true,
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(
      JSON.stringify(
        {
          metadata: {
            default: true,
            import: true,
            node: true,
          },
        },
        null,
        2,
      ),
    );
  });

  it('sorts numeric keys behind special-character keys', () => {
    const obj = {
      values: {
        2: 'two',
        '-flag': 'flag',
        10: 'ten',
        '#alias': 'alias',
      },
    };

    expect(stringifyJsonWithSortedKeys(obj)).toBe(`{
  "values": {
    "#alias": "alias",
    "-flag": "flag",
    "10": "ten",
    "2": "two"
  }
}`);
  });
});
