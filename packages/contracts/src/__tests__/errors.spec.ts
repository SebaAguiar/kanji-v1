import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { formatZodIssues } from '../errors.js';

describe('formatZodIssues', () => {
  it('should format simple Zod issues', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'invalid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodIssues(result.error.issues);
      expect(formatted.error).toBe('VALIDATION_ERROR');
      expect(formatted.message).toBe('Request validation failed');
      expect(formatted.issues).toHaveLength(1);
      expect(formatted.issues[0].path).toBe('email');
      expect(formatted.issues[0].code).toBe('invalid_string');
    }
  });

  it('should format nested Zod issues with dot-separated paths', () => {
    const schema = z.object({
      address: z.object({
        street: z.string().min(1),
      }),
    });
    const result = schema.safeParse({ address: { street: '' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodIssues(result.error.issues);
      expect(formatted.issues[0].path).toBe('address.street');
    }
  });

  it('should return empty issues array when no issues provided', () => {
    const formatted = formatZodIssues([]);
    expect(formatted.issues).toEqual([]);
    expect(formatted.error).toBe('VALIDATION_ERROR');
  });
});
