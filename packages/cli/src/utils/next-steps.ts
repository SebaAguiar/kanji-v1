import pc from 'picocolors';

export interface NextStepsExtra {
  pm?: 'bun' | 'npm' | 'pnpm';
  db?: 'postgres' | 'mongodb' | 'none';
  ciPlatform?: 'github' | 'gitlab';
  webhookAuth?: 'none' | 'secret' | 'signature';
}

export function printNextSteps(
  type: 'project' | 'resource' | 'auth' | 'webhook' | 'ci',
  name: string,
  extra?: NextStepsExtra,
): void {
  console.log(pc.bold(pc.yellow('\nNext Steps:')));
  switch (type) {
    case 'project': {
      const pm = extra?.pm || 'bun';
      const runCmd = pm === 'bun' ? 'bun' : `${pm} run`;
      const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;
      console.log(`  1. cd ${name}`);
      console.log(`  2. Run: ${pc.cyan(installCmd)}`);
      if (extra?.db === 'postgres') {
        console.log(`  3. Start database (e.g., ${pc.cyan('docker-compose up -d')})`);
        console.log(`  4. Generate & apply database migrations:`);
        console.log(`     ${pc.cyan('kanji migrate:create')}`);
        console.log(`     ${pc.cyan('kanji migrate')}`);
        console.log(`  5. Start development server: ${pc.cyan(`${runCmd} dev`)}`);
      } else {
        console.log(`  3. Start development server: ${pc.cyan(`${runCmd} dev`)}`);
      }
      break;
    }
    case 'resource': {
      console.log(`  1. Verify the module auto-registration in ${pc.cyan('src/app.module.ts')}`);
      if (extra?.db === 'postgres') {
        console.log(`  2. Generate and apply database migrations:`);
        console.log(`     ${pc.cyan('kanji migrate:create')}`);
        console.log(`     ${pc.cyan('kanji migrate')}`);
      }
      console.log(`  3. Start the dev server and test your endpoints`);
      break;
    }
    case 'auth': {
      console.log(`  1. Verify the Auth controller and module in ${pc.cyan('src/auth/')}`);
      console.log(`  2. Ensure ${pc.cyan('JWT_SECRET')} is configured in your ${pc.cyan('.env')} file`);
      break;
    }
    case 'webhook': {
      console.log(`  1. Configure the webhook in your provider dashboard (e.g., Stripe)`);
      if (extra?.webhookAuth === 'secret' || extra?.webhookAuth === 'signature') {
        console.log(`  2. Add the signing secret key to your ${pc.cyan('.env')} file`);
      }
      console.log(`  3. Start your dev server and trigger test webhook events`);
      break;
    }
    case 'ci': {
      const platformName = extra?.ciPlatform === 'github' ? 'GitHub Actions' : 'GitLab CI';
      const filePath = extra?.ciPlatform === 'github' ? '.github/workflows/ci.yml' : '.gitlab-ci.yml';
      console.log(`  1. Review the pipeline configuration in ${pc.cyan(filePath)}`);
      console.log(`  2. Commit and push the configuration file to trigger a build on ${pc.bold(platformName)}`);
      break;
    }
  }
  console.log('');
}
