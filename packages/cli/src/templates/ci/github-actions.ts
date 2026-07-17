import { ProjectOptions } from '../../types.js';

export function getGitHubActionsTemplate(opts: ProjectOptions): string {
  const pm = opts.pm || 'bun';
  const runCmd = pm === 'bun' ? 'bun run' : `${pm} run`;
  const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;

  let setupSteps = '';
  if (pm === 'bun') {
    setupSteps = `      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest`;
  } else {
    setupSteps = `      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: '${pm}'`;
  }

  let testStep = '';
  if (opts.tests !== false) {
    testStep = `
      - name: Run tests
        run: ${pm === 'bun' ? 'bun test' : `${pm} test`}`;
  }

  let lintStep = '';
  if (opts.lint !== false) {
    lintStep = `
      - name: Run lint
        continue-on-error: true
        run: ${runCmd} lint`;
  }

  let buildStep = '';
  if (opts.build !== false) {
    buildStep = `
      - name: Build project
        run: ${runCmd} build`;
  }

  return `name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

${setupSteps}

      - name: Install dependencies
        run: ${installCmd}
${testStep}
${lintStep}
${buildStep}
`;
}
