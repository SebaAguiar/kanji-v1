import { ProjectOptions } from '../../types.js';

export function getBitbucketPipelinesTemplate(opts: ProjectOptions): string {
  const pm = opts.pm || 'bun';
  const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;
  const image = pm === 'bun' ? 'oven/bun:1' : 'node:22';

  let scriptSteps = [`- ${installCmd}`];
  if (opts.tests !== false) {
    scriptSteps.push(pm === 'bun' ? `- bun test` : `- ${pm} test`);
  }
  if (opts.lint !== false) {
    scriptSteps.push(pm === 'bun' ? `- bun run lint` : `- ${pm} run lint`);
  }
  if (opts.build !== false) {
    scriptSteps.push(pm === 'bun' ? `- bun run build` : `- ${pm} run build`);
  }

  const scriptStr = scriptSteps.map((s) => `          ${s}`).join('\n');
  const cacheName = pm === 'pnpm' ? 'pnpm' : 'node';

  return `image: ${image}
pipelines:
  default:
    - step:
        name: Build, Lint and Test
        caches:
          - ${cacheName}
        script:
${scriptStr}
`;
}
