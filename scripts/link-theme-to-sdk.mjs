import { lstat, mkdir, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const sdkDir = process.argv[2];

if (!sdkDir) {
  console.error('Usage: node scripts/link-theme-to-sdk.mjs <openwrt-sdk-dir>');
  process.exit(1);
}

const packageDir = resolve(sdkDir, 'package', 'luci-theme-neonwrt');
const themeDir = resolve('luci-theme-neonwrt');

await mkdir(resolve(sdkDir, 'package'), { recursive: true });

try {
  const stat = await lstat(packageDir);
  if (stat.isSymbolicLink()) {
    await rm(packageDir);
  } else {
    throw new Error(`${packageDir} already exists and is not a symlink.`);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await symlink(themeDir, packageDir, 'dir');
console.log(`Linked ${packageDir} -> ${themeDir}`);
