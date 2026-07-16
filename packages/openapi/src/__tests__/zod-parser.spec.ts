import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { parseZodSchema } from '../zod-parser.js';

describe('Zod Parser', () => {
  it('should parse basic types', () => {
    expect(parseZodSchema(z.string())).toEqual({ type: 'string' });
    expect(parseZodSchema(z.number())).toEqual({ type: 'number' });
    expect(parseZodSchema(z.boolean())).toEqual({ type: 'boolean' });
    expect(parseZodSchema(z.date())).toEqual({ type: 'string', format: 'date-time' });
    expect(parseZodSchema(z.bigint())).toEqual({ type: 'integer', format: 'int64' });
  });

  it('should parse string formats and patterns', () => {
    expect(parseZodSchema(z.string().email())).toEqual({ type: 'string', format: 'email' });
    expect(parseZodSchema(z.string().uuid())).toEqual({ type: 'string', format: 'uuid' });
    expect(parseZodSchema(z.string().url())).toEqual({ type: 'string', format: 'uri' });
    expect(parseZodSchema(z.string().regex(/^[a-z]+$/))).toEqual({
      type: 'string',
      pattern: '^[a-z]+$',
    });
    expect(parseZodSchema(z.string().startsWith('abc'))).toEqual({
      type: 'string',
      pattern: '^abc',
    });
    expect(parseZodSchema(z.string().endsWith('xyz'))).toEqual({ type: 'string', pattern: 'xyz$' });
    expect(parseZodSchema(z.string().includes('hello'))).toEqual({
      type: 'string',
      pattern: 'hello',
    });
  });

  it('should parse literal and enum types', () => {
    expect(parseZodSchema(z.literal('test'))).toEqual({ type: 'string', enum: ['test'] });
    expect(parseZodSchema(z.literal(123))).toEqual({ type: 'number', enum: ['123'] });
    expect(parseZodSchema(z.enum(['A', 'B', 'C']))).toEqual({
      type: 'string',
      enum: ['A', 'B', 'C'],
    });

    enum NumericEnum {
      X,
      Y,
      Z,
    }
    expect(parseZodSchema(z.nativeEnum(NumericEnum))).toEqual({
      type: 'number',
      enum: ['0', '1', '2'],
    });

    enum StringEnum {
      Foo = 'foo',
      Bar = 'bar',
    }
    expect(parseZodSchema(z.nativeEnum(StringEnum))).toEqual({
      type: 'string',
      enum: ['foo', 'bar'],
    });
  });

  it('should parse object shapes and requirements', () => {
    const schema = z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      age: z.number(),
    });

    const parsed = parseZodSchema(schema);
    expect(parsed.type).toBe('object');
    expect(parsed.properties).toBeDefined();
    expect(parsed.properties!.id).toEqual({ type: 'string', format: 'uuid' });
    expect(parsed.properties!.name).toEqual({ type: 'string' });
    expect(parsed.properties!.age).toEqual({ type: 'number' });
    expect(parsed.required).toEqual(['id', 'age']);
  });

  it('should parse array and tuple types', () => {
    expect(parseZodSchema(z.array(z.string()))).toEqual({
      type: 'array',
      items: { type: 'string' },
    });

    expect(parseZodSchema(z.tuple([z.string(), z.number()]))).toEqual({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
      minItems: 2,
      maxItems: 2,
    });
  });

  it('should parse records, unions, and intersections', () => {
    expect(parseZodSchema(z.record(z.number()))).toEqual({
      type: 'object',
      additionalProperties: { type: 'number' },
    });

    expect(parseZodSchema(z.union([z.string(), z.number()]))).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    });

    expect(
      parseZodSchema(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }))),
    ).toEqual({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
      ],
    });

    const discUnion = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), val: z.string() }),
      z.object({ type: z.literal('b'), val: z.number() }),
    ]);
    const parsedDiscUnion = parseZodSchema(discUnion);
    expect(parsedDiscUnion.oneOf).toHaveLength(2);
  });

  it('should unwrap wrappers like optionals, nullables, and defaults', () => {
    expect(parseZodSchema(z.string().nullable())).toEqual({ type: 'string', nullable: true });
    expect(parseZodSchema(z.string().default('default'))).toEqual({ type: 'string' });
    expect(parseZodSchema(z.string().promise())).toEqual({ type: 'string' });
    expect(parseZodSchema(z.string().brand<'brand'>())).toEqual({ type: 'string' });
  });

  it('should parse descriptions from .describe()', () => {
    const schema = z.string().describe('Custom string description');
    expect(parseZodSchema(schema)).toEqual({
      type: 'string',
      description: 'Custom string description',
    });
  });
});
