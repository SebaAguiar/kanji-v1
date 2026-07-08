export enum ValidationSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface ValidationResult {
  severity: ValidationSeverity;
  message: string;
  location: {
    controller: string;
    method?: string;
  };
  suggestion?: string;
}
