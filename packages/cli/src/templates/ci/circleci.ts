import { ProjectOptions } from '../../types.js';

export function getCircleCIConfigTemplate(opts: ProjectOptions): string {
  const pm = opts.pm || 'bun';
  const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;
  const image = pm === 'bun' ? 'oven/bun:1' : 'cimg/node:22.0';

  let steps = [
    `      - checkout`,
    `      - run:`,
    `          name: Install dependencies`,
    `          command: ${installCmd}`,
  ];

  if (opts.tests !== false) {
    steps.push(
      `      - run:`,
      `          name: Run tests`,
      `          command: ${pm === 'bun' ? 'bun test' : `${pm} test`}`,
    );
  }
  if (opts.lint !== false) {
    steps.push(
      `      - run:`,
      `          name: Run lint`,
      `          command: ${pm === 'bun' ? 'bun run lint' : `${pm} run lint`}`,
    );
  }
  if (opts.build !== false) {
    steps.push(
      `      - run:`,
      `          name: Build project`,
      `          command: ${pm === 'bun' ? 'bun run build' : `${pm} run build`}`,
    );
  }

  const stepsStr = steps.join('\n');

  return `version: 2.1
jobs:
  build:
    docker:
      - image: ${image}
    steps:
${stepsStr}
workflows:
  version: 2
  build_and_test:
    jobs:
      - build
`;
}
