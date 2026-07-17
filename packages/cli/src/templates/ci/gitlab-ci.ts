import { ProjectOptions } from '../../types.js';

export function getGitLabCITemplate(opts: ProjectOptions): string {
  const pm = opts.pm || 'bun';
  const runCmd = pm === 'bun' ? 'bun run' : `${pm} run`;
  const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;

  const image = pm === 'bun' ? 'oven/bun:latest' : 'node:20';

  const stages = ['install'];
  if (opts.tests !== false) stages.push('test');
  if (opts.lint !== false) stages.push('lint');
  if (opts.build !== false) stages.push('build');

  const stagesStr = stages.map((s) => `  - ${s}`).join('\n');

  let testJob = '';
  if (opts.tests !== false) {
    testJob = `
test:
  stage: test
  script:
    - ${pm === 'bun' ? 'bun test' : `${pm} test`}
`;
  }

  let lintJob = '';
  if (opts.lint !== false) {
    lintJob = `
lint:
  stage: lint
  allow_failure: true
  script:
    - ${runCmd} lint`;
  }

  let buildJob = '';
  if (opts.build !== false) {
    buildJob = `
build_project:
  stage: build
  script:
    - ${runCmd} build
`;
  }

  return `image: ${image}

stages:
${stagesStr}

cache:
  paths:
    - node_modules/
    - .npm/
    - .pnpm-store/

install_dependencies:
  stage: install
  script:
    - ${installCmd}
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour
${testJob}${lintJob}${buildJob}`;
}
