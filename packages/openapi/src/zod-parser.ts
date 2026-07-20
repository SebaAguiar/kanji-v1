import { z } from 'zod';
import type { OpenApiSchema } from './types.js';

function escapeRegex(string: string): string {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function parseZodSchema(schema: z.ZodTypeAny): OpenApiSchema {
  const def = schema._def;
  const typeName = def.typeName;
  let parsed: OpenApiSchema = {};

  switch (typeName) {
    case 'ZodString': {
      parsed = { type: 'string' };
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'email') parsed.format = 'email';
          else if (check.kind === 'uuid') parsed.format = 'uuid';
          else if (check.kind === 'url') parsed.format = 'uri';
          else if (check.kind === 'min') parsed.minLength = check.value;
          else if (check.kind === 'max') parsed.maxLength = check.value;
          else if (check.kind === 'length') {
            parsed.minLength = check.value;
            parsed.maxLength = check.value;
          } else if (check.kind === 'regex') parsed.pattern = check.regex.source;
          else if (check.kind === 'startsWith') parsed.pattern = `^${escapeRegex(check.value)}`;
          else if (check.kind === 'endsWith') parsed.pattern = `${escapeRegex(check.value)}$`;
          else if (check.kind === 'includes') parsed.pattern = escapeRegex(check.value);
        }
      }
      break;
    }
    case 'ZodNumber': {
      parsed = { type: 'number' };
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'min') parsed.minimum = check.value;
          else if (check.kind === 'max') parsed.maximum = check.value;
        }
      }
      break;
    }
    case 'ZodBoolean': {
      parsed = { type: 'boolean' };
      break;
    }
    case 'ZodDate': {
      parsed = { type: 'string', format: 'date-time' };
      break;
    }
    case 'ZodBigInt': {
      parsed = { type: 'integer', format: 'int64' };
      break;
    }
    case 'ZodEnum': {
      parsed = { type: 'string', enum: def.values };
      break;
    }
    case 'ZodLiteral': {
      const val = def.value;
      const t =
        typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'string';
      parsed = { type: t, enum: [String(val)] };
      break;
    }
    case 'ZodNativeEnum': {
      const values = Object.values(def.values);
      const stringValues = values.filter((v): v is string => typeof v === 'string');
      const numericValues = values.filter((v): v is number => typeof v === 'number');
      const enumValues = numericValues.length > 0 ? numericValues : stringValues;
      const type = typeof enumValues[0] === 'number' ? 'number' : 'string';
      parsed = { type, enum: enumValues.map(String) };
      break;
    }
    case 'ZodObject': {
      const properties: Record<string, OpenApiSchema> = {};
      const required: string[] = [];
      const shape = def.shape();

      for (const [key, value] of Object.entries(shape)) {
        const parsedProp = parseZodSchema(value as z.ZodTypeAny);
        properties[key] = parsedProp;

        const val = value as z.ZodTypeAny;
        const isOptional = val.isOptional() || val._def.typeName === 'ZodOptional';
        if (!isOptional) {
          required.push(key);
        }
      }

      parsed = { type: 'object', properties };
      if (required.length > 0) {
        parsed.required = required;
      }
      break;
    }
    case 'ZodArray': {
      parsed = {
        type: 'array',
        items: parseZodSchema(def.type),
      };
      break;
    }
    case 'ZodTuple': {
      const items = (def.items as z.ZodTypeAny[]).map((i) => parseZodSchema(i));
      parsed = {
        type: 'array',
        prefixItems: items,
        minItems: items.length,
        maxItems: items.length,
      };
      break;
    }
    case 'ZodRecord': {
      parsed = {
        type: 'object',
        additionalProperties: parseZodSchema(def.valueType),
      };
      break;
    }
    case 'ZodIntersection': {
      parsed = {
        allOf: [parseZodSchema(def.left), parseZodSchema(def.right)],
      };
      break;
    }
    case 'ZodDiscriminatedUnion': {
      const options = Array.from((def.options as Map<string, z.ZodTypeAny>).values());
      parsed = {
        oneOf: options.map((opt) => parseZodSchema(opt)),
      };
      break;
    }
    case 'ZodUnion': {
      const schemas = (def.options as z.ZodTypeAny[]).map((opt) => parseZodSchema(opt));
      parsed = { anyOf: schemas };
      break;
    }
    case 'ZodOptional': {
      parsed = parseZodSchema(def.innerType);
      break;
    }
    case 'ZodNullable': {
      parsed = parseZodSchema(def.innerType);
      parsed.nullable = true;
      break;
    }
    case 'ZodEffects': {
      parsed = parseZodSchema(def.schema);
      break;
    }
    case 'ZodDefault': {
      parsed = parseZodSchema(def.innerType);
      break;
    }
    case 'ZodBranded':
    case 'ZodPromise': {
      parsed = parseZodSchema(def.type);
      break;
    }
    case 'ZodPipeline': {
      parsed = parseZodSchema(def.out);
      break;
    }
    default:
      parsed = { type: 'string' };
      break;
  }

  if (def.description) {
    parsed.description = def.description;
  }

  return parsed;
}
