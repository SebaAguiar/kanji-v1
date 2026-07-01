import { z } from 'zod';
import type { OpenApiSchema } from './types.js';

export function parseZodSchema(schema: z.ZodTypeAny): OpenApiSchema {
  const def = schema._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodString': {
      const s: OpenApiSchema = { type: 'string' };
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'email') s.format = 'email';
          if (check.kind === 'uuid') s.format = 'uuid';
          if (check.kind === 'url') s.format = 'uri';
        }
      }
      return s;
    }
    case 'ZodNumber': {
      return { type: 'number' };
    }
    case 'ZodBoolean': {
      return { type: 'boolean' };
    }
    case 'ZodEnum': {
      return { type: 'string', enum: def.values };
    }
    case 'ZodObject': {
      const properties: Record<string, OpenApiSchema> = {};
      const required: string[] = [];
      const shape = def.shape();

      for (const [key, value] of Object.entries(shape)) {
        const parsed = parseZodSchema(value as z.ZodTypeAny);
        properties[key] = parsed;

        const val = value as z.ZodTypeAny;
        // Check if property is optional in Zod
        const isOptional = val.isOptional() || val._def.typeName === 'ZodOptional';
        if (!isOptional) {
          required.push(key);
        }
      }

      const s: OpenApiSchema = { type: 'object', properties };
      if (required.length > 0) {
        s.required = required;
      }
      return s;
    }
    case 'ZodArray': {
      return {
        type: 'array',
        items: parseZodSchema(def.type),
      };
    }
    case 'ZodOptional': {
      return parseZodSchema(def.innerType);
    }
    case 'ZodNullable': {
      const inner = parseZodSchema(def.innerType);
      inner.nullable = true;
      return inner;
    }
    case 'ZodEffects': {
      return parseZodSchema(def.schema);
    }
    case 'ZodUnion': {
      const schemas = (def.options as z.ZodTypeAny[]).map((opt) => parseZodSchema(opt));
      return { anyOf: schemas };
    }
    default:
      return { type: 'string' };
  }
}
