import { describe, it, expect } from 'bun:test';
import {
  capitalize,
  toSingular,
  toPlural,
  toCamelCase,
  toKebabCase,
  fileExists,
  ensureArray,
  slugify,
} from '../utils/helpers.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('hello world')).toBe('Hello world');
  });

  it('should return empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('toSingular', () => {
  it('should convert plurals ending in "ies"', () => {
    expect(toSingular('categories')).toBe('category');
    expect(toSingular('cities')).toBe('city');
  });

  it('should remove trailing "s"', () => {
    expect(toSingular('users')).toBe('user');
    expect(toSingular('dogs')).toBe('dog');
  });

  it('should leave words ending in "ss" unchanged', () => {
    expect(toSingular('access')).toBe('access');
  });
});

describe('toPlural', () => {
  it('should add "s" by default', () => {
    expect(toPlural('user')).toBe('users');
    expect(toPlural('dog')).toBe('dogs');
  });

  it('should convert "y" to "ies" when preceded by consonant', () => {
    expect(toPlural('category')).toBe('categories');
    expect(toPlural('city')).toBe('cities');
  });
});

describe('toCamelCase', () => {
  it('should convert kebab-case to camelCase', () => {
    expect(toCamelCase('hello-world')).toBe('helloWorld');
    expect(toCamelCase('my-long-string')).toBe('myLongString');
  });
});

describe('toKebabCase', () => {
  it('should convert camelCase to kebab-case', () => {
    expect(toKebabCase('helloWorld')).toBe('hello-world');
    expect(toKebabCase('myLongString')).toBe('my-long-string');
  });

  it('should handle spaces and underscores', () => {
    expect(toKebabCase('hello world')).toBe('hello-world');
    expect(toKebabCase('hello_world')).toBe('hello-world');
  });
});

describe('fileExists', () => {
  it('should return true for existing files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kanji-test-'));
    const testFile = join(dir, 'test.txt');
    await writeFile(testFile, 'content');
    expect(await fileExists(testFile)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('should return false for missing files', async () => {
    expect(await fileExists('/tmp/non-existent-file-xyz')).toBe(false);
  });
});

describe('ensureArray', () => {
  it('should wrap single value in array', () => {
    expect(ensureArray('hello')).toEqual(['hello']);
    expect(ensureArray(42)).toEqual([42]);
  });

  it('should return array as-is', () => {
    const arr = [1, 2, 3];
    expect(ensureArray(arr)).toBe(arr);
  });
});

describe('slugify', () => {
  it('should convert to lowercase slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('Hello   World')).toBe('hello-world');
    expect(slugify('Test - 123')).toBe('test-123');
  });
});
