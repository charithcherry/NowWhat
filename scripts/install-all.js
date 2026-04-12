#!/usr/bin/env node
/**
 * Install npm dependencies for the monorepo root and every Next.js app.
 * From repo root: node scripts/install-all.js   or   npm run setup
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const apps = [
  "base",
  "skin-hair-analysis",
  "nutrition-wellness",
  "nutrition-yelp",
  "fitness-dashboard",
  "community",
];

function run(cmd, cwd, label) {
  console.log(`\n━━ ${label} ━━\n`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

try {
  run("npm install", root, "Repository root (concurrently)");
  for (const dir of apps) {
    run("npm install", path.join(root, dir), dir);
  }
  console.log("\n✓ All installs finished. Next: copy each app’s .env.local.example → .env.local where needed, then npm run dev\n");
} catch (e) {
  console.error("\n✗ Install failed. Fix the error above, then run: npm run setup\n");
  process.exit(1);
}
