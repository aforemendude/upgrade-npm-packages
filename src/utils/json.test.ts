import { describe, it, expect } from 'vitest';
import { stringify } from './json';

describe('json util stringify', () => {
  it('should sort simple object keys alphabetically', () => {
    const obj = { c: 3, a: 1, b: 2 };
    const result = stringify(obj);
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
    const result = stringify(obj);
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

    // Check order manually in string
    const lines = result.split('\n').map((l) => l.trim());
    const keys = lines.filter((l) => l.includes(':')).map((l) => l.split(':')[0]!.replace(/"/g, ''));
    expect(keys).toEqual(['a', 'b', 'y', 'z']);
  });

  it('should NOT sort array elements but sort object keys inside arrays', () => {
    const obj = {
      list: [
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ],
    };
    const result = stringify(obj);
    const parsed = JSON.parse(result);
    expect(parsed.list[0]).toEqual({ a: 1, b: 2 });
    expect(parsed.list[1]).toEqual({ c: 3, d: 4 });

    const lines = result.split('\n').map((l) => l.trim());
    const keys = lines.filter((l) => l.includes(':')).map((l) => l.split(':')[0]!.replace(/"/g, ''));
    // keys should be 'list' (from top), then 'a', 'b' (from first item), then 'c', 'd' (from second item)
    // Actually allKeys = ['list', 'a', 'b', 'c', 'd'] sorted = ['a', 'b', 'c', 'd', 'list']
    // But list is at the root, so it appears first in the string output.
    expect(keys).toEqual(['list', 'a', 'b', 'c', 'd']);
  });

  it('should handle null values correctly', () => {
    const obj = { b: null, a: 1 };
    const result = stringify(obj);
    expect(result).toBe(JSON.stringify({ a: 1, b: null }, ['a', 'b'], 2));
  });

  it('should handle overlapping keys at different levels', () => {
    const obj = {
      b: { a: 1 },
      a: 2,
    };
    const result = stringify(obj);
    // allKeys = ['b', 'a'] sorted = ['a', 'b']
    const expected = JSON.stringify({ a: 2, b: { a: 1 } }, ['a', 'b'], 2);
    expect(result).toBe(expected);
  });

  it('should be stable across multiple calls', () => {
    const obj = { c: 3, a: 1, b: 2 };
    expect(stringify(obj)).toBe(stringify(obj));
  });
});
