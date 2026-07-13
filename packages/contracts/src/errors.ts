import type { ZodIssue } from 'zod';

export interface ValidationErrorResponse {
  error: string;
  message: string;
  issues: Array<{
    path: string;
    code: string;
    message: string;
  }>;
}

export function formatZodIssues(issues: ZodIssue[]): ValidationErrorResponse {
  return {
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    issues: issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  };
}
