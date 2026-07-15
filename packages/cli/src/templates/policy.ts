import { capitalize, toSingular } from '../utils/inflection.js';

export const getPolicyTemplate = (
  resourceName: string,
  actionRules: Record<string, { model: 'role-based' | 'owner-based'; roles?: string[] }>
): string => {
  const singular = toSingular(resourceName);
  const singularCapitalized = capitalize(singular);
  
  let imports = `import { Injectable } from '@kanjijs/core';\n`;
  imports += `import type { ResourcePolicy } from '@kanjijs/auth';\n`;
  imports += `import type { Context } from 'hono';\n`;

  let body = `@Injectable()\nexport class ${singularCapitalized}Policy implements ResourcePolicy {\n`;

  const actions = ['read', 'create', 'update', 'delete'];
  for (const action of actions) {
    const rule = actionRules[action];
    const methodName = `can${capitalize(action)}`;

    body += `  ${methodName}(c: Context, resource: any, user: any): boolean {\n`;
    if (rule) {
      if (rule.model === 'role-based') {
        const rolesArray = JSON.stringify(rule.roles || ['admin']);
        body += `    const allowed = ${rolesArray};\n`;
        body += `    return user.roles.some((role: string) => allowed.includes(role));\n`;
      } else {
        body += `    return resource.userId === user.userId || user.roles.includes('admin');\n`;
      }
    } else {
      body += `    return true;\n`;
    }
    body += `  }\n\n`;
  }

  body = body.trimEnd() + '\n}\n';
  return `${imports}\n${body}`;
};
