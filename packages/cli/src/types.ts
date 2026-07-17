export interface GeneratorOptions {
  crudActions: ('create' | 'findAll' | 'findOne' | 'update' | 'delete')[];
  authModel: 'none' | 'role-based' | 'owner-based';
  dbAdapter: 'postgres' | 'mongodb' | 'none';
  generateTests: boolean;
}

export type DatabaseType = 'postgres' | 'mongodb' | 'none';
export type AuthProvider = 'jwt' | 'google' | 'github' | 'microsoft';
export type CiPlatform = 'github' | 'gitlab' | 'none';
export type PackageManager = 'bun' | 'npm' | 'pnpm';
export type AuthGenType = 'policies' | 'endpoints';

export interface ProjectOptions {
  appName: string;
  db?: DatabaseType;
  auth?: AuthProvider[];
  openapi?: boolean;
  docker?: boolean;
  ci?: CiPlatform;
  tests?: boolean;
  pm?: PackageManager;
  lint?: boolean;
  build?: boolean;
}

export interface WebhookOptions {
  name: string;
  events: string[];
  auth: 'none' | 'secret' | 'signature';
  retry: boolean;
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  category: string;
  message: string;
  fixable?: boolean;
}

export type TemplateName = 'starter' | 'basic' | 'saas-starter';

