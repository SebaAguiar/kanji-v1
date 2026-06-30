import { $ZodIssue } from 'zod/v4/core';

export interface ValidationErrorResponse {
  error: string;
  issues: Array<{
    path: string;
    code: string;
    message: string;
  }>;
}

export function formatZodIssues(issues: $ZodIssue[]): ValidationErrorResponse {
  return {
    error: 'Validation Failed',
    issues: issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  };
}
