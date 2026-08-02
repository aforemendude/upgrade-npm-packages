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
});
