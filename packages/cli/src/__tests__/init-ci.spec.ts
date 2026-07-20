import { describe, it, expect } from 'bun:test';
import { getBitbucketPipelinesTemplate } from '../templates/ci/bitbucket.js';
import { getCircleCIConfigTemplate } from '../templates/ci/circleci.js';
import { getDockerfileTemplate } from '../templates/dockerfile.js';
import { ProjectOptions } from '../types.js';

describe('CI/CD Template Generators', () => {
  const opts: ProjectOptions = {
    appName: 'test-app',
    pm: 'bun',
    tests: true,
    lint: true,
    build: true,
  };

  it('should generate a valid Bitbucket Pipelines template with Bun', () => {
    const template = getBitbucketPipelinesTemplate(opts);
    expect(template).toContain('image: oven/bun:1');
    expect(template).toContain('- bun install');
    expect(template).toContain('- bun test');
    expect(template).toContain('- bun run lint');
    expect(template).toContain('- bun run build');
  });

  it('should generate a valid CircleCI config template with Bun', () => {
    const template = getCircleCIConfigTemplate(opts);
    expect(template).toContain('image: oven/bun:1');
    expect(template).toContain('command: bun install');
    expect(template).toContain('command: bun test');
    expect(template).toContain('command: bun run lint');
    expect(template).toContain('command: bun run build');
  });

  it('should generate a valid Dockerfile template using Bun', () => {
    const template = getDockerfileTemplate(opts);
    expect(template).toContain('FROM oven/bun:1 AS build');
    expect(template).toContain('FROM oven/bun:1-slim');
    expect(template).toContain('CMD ["bun", "dist/main.js"]');
  });
});
