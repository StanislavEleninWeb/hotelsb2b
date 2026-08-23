// Metro config for a pnpm monorepo. Without this, Metro can't resolve the
// symlinked @hotel/shared workspace package (the #1 reason Expo-in-a-monorepo
// fails to bundle). NOTE: this config is UNEXECUTED in this repo — no device build
// has been run here — so treat it as best-effort until someone runs `expo start`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes to packages/shared are picked up.
config.watchFolders = [workspaceRoot];
// Resolve modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm uses symlinks; let Metro follow them.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
