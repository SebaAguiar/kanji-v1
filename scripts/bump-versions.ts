/**
 * Bump versions across all Kanji packages.
 *
 * Updates:
 *   - `version` field in every package
 *   - `@kanjijs/*` references in `peerDependencies` (they use concrete semver)
 *
 * Does NOT touch `dependencies` / `devDependencies` — those stay as
 * `workspace:*` for local resolution. pnpm converts them automatically
 * at publish time.
 *
 * Usage:
 *   bun run scripts/bump-versions.ts -- <patch|minor|major|<semver>>
 *
 * Examples:
 *   bun run scripts/bump-versions.ts -- patch   # 1.0.0-alpha.1  → 1.0.0-alpha.2
 *   bun run scripts/bump-versions.ts -- patch   # 1.0.0         → 1.0.1
 *   bun run scripts/bump-versions.ts -- minor   # 1.0.0-alpha.1 → 1.1.0-alpha.0
 *   bun run scripts/bump-versions.ts -- major   # 1.0.0-alpha.1 → 2.0.0-alpha.0
 *   bun run scripts/bump-versions.ts -- 1.0.0   # explicit
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PACKAGES = [
  "packages/common",
  "packages/core",
  "packages/contracts",
  "packages/platform-hono",
  "packages/store",
  "packages/auth",
  "packages/openapi",
  "packages/testing",
  "packages/cli",
];

function bumpVersion(current: string, type: string): string {
  const base = current.replace(/\+.+$/, "");
  const isPre = base.includes("-");
  const match = base.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)\.(\d+))?$/,
  );

  if (!match) throw new Error(`Cannot parse version: ${current}`);

  let [, majorStr, minorStr, patchStr, preTag, preVerStr] = match;
  let major = parseInt(majorStr);
  let minor = parseInt(minorStr);
  let patch = parseInt(patchStr);

  if (isPre) {
    // Pre-release version: advance pre-release counter for patch,
    // bump base for minor/major and reset pre-release
    if (type === "patch") {
      const preVer = parseInt(preVerStr || "0") + 1;
      return `${major}.${minor}.${patch}-${preTag}.${preVer}`;
    }
    if (type === "minor") {
      return `${major}.${minor + 1}.0-${preTag}.0`;
    }
    if (type === "major") {
      return `${major + 1}.0.0-${preTag}.0`;
    }
    return type;
  }

  // Stable version
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else if (type === "patch") {
    patch += 1;
  } else {
    return type;
  }

  return `${major}.${minor}.${patch}`;
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: bun run scripts/bump-versions.ts -- <patch|minor|major|<version>>",
    );
    process.exit(1);
  }

  const VALID_TYPES = ["patch", "minor", "major"];
  const isExplicit = !VALID_TYPES.includes(arg);

  const entries = PACKAGES.map((dir) => {
    const path = resolve(ROOT, dir, "package.json");
    const json = JSON.parse(readFileSync(path, "utf-8"));
    return { dir, path, json };
  });

  const currentVersion = entries[0].json.version;
  const newVersion = isExplicit ? arg : bumpVersion(currentVersion, arg);

  console.log(`Bumping ${currentVersion} → ${newVersion}\n`);

  for (const pkg of entries) {
    const oldVersion = pkg.json.version;
    pkg.json.version = newVersion;

    // Update @kanjijs/* references in peerDependencies
    for (const depType of ["peerDependencies"]) {
      const deps = pkg.json[depType];
      if (!deps) continue;
      for (const key of Object.keys(deps)) {
        if (key.startsWith("@kanjijs/")) {
          deps[key] = `^${newVersion}`;
        }
      }
    }

    writeFileSync(pkg.path, JSON.stringify(pkg.json, null, 2) + "\n");
    console.log(`  ${pkg.json.name}: ${oldVersion} → ${newVersion}`);
  }

  console.log(
    `\nDone. Run \`pnpm install\` to update the lockfile and \`pnpm build\` to verify.`,
  );
}

main();
