import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const packageName = 'luci-theme-neonwrt';
const release = '1';
const arch = 'all';
const version = (await readFile('VERSION', 'utf8')).trim();
const releaseIpkName = `${packageName}-all.ipk`;
const releaseShaName = `${releaseIpkName}.sha256`;
const workDir = 'dist/.ipk-build';
const dataDir = join(workDir, 'data');
const controlDir = join(workDir, 'control');
const tarBin = existsSync('/opt/homebrew/bin/gtar') ? '/opt/homebrew/bin/gtar' : 'tar';

const forbiddenPaths = [
  'luci-theme-neonwrt/root/etc/config/network',
  'luci-theme-neonwrt/root/etc/config/system'
];

for (const path of forbiddenPaths) {
  try {
    await access(path);
    throw new Error(`Refusing to package router config file: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const result = spawnSync('tar', [
  '-czf',
  `dist/${packageName}-${version}.tar.gz`,
  'luci-theme-neonwrt'
], { stdio: 'inherit' });

if (result.status !== 0) {
  throw new Error('Theme package archive failed.');
}

await mkdir(dataDir, { recursive: true });
await mkdir(controlDir, { recursive: true });
await cp('luci-theme-neonwrt/root', dataDir, { recursive: true });
await mkdir(join(dataDir, 'usr/lib/lua/luci/view/themes'), { recursive: true });
await cp(
  'luci-theme-neonwrt/luasrc/view/themes/neonwrt',
  join(dataDir, 'usr/lib/lua/luci/view/themes/neonwrt'),
  { recursive: true }
);

await writeFile(join(controlDir, 'control'), [
  `Package: ${packageName}`,
  `Version: ${version}-${release}`,
  `Architecture: ${arch}`,
  'Maintainer: itworksig <https://github.com/itworksig>',
  'Section: luci',
  'Priority: optional',
  'Depends: luci-base',
  'Source: https://github.com/itworksig/luci-theme-neowrt',
  'Description: NeonWrt cyber terminal LuCI theme',
  ''
].join('\n'));

await writeFile(join(controlDir, 'postinst'), `#!/bin/sh
uci -q batch <<'EOF' || true
set luci.themes.NeonWrt='/luci-static/neonwrt'
set luci.main.mediaurlbase='/luci-static/neonwrt'
commit luci
EOF
rm -rf /tmp/luci-* /tmp/luci-indexcache 2>/dev/null || true
/etc/init.d/uhttpd restart 2>/dev/null || true
exit 0
`);

await writeFile(join(controlDir, 'prerm'), `#!/bin/sh
if [ "$(uci -q get luci.main.mediaurlbase)" = "/luci-static/neonwrt" ]; then
  uci -q set luci.main.mediaurlbase='/luci-static/bootstrap'
fi
uci -q delete luci.themes.NeonWrt 2>/dev/null || true
uci -q commit luci
rm -rf /tmp/luci-* /tmp/luci-indexcache 2>/dev/null || true
exit 0
`);

spawnSync('chmod', ['0755', join(controlDir, 'postinst'), join(controlDir, 'prerm')], { stdio: 'inherit' });

for (const [archive, cwd, target] of [
  ['debian-binary', workDir, null],
  ['control.tar.gz', controlDir, '.'],
  ['data.tar.gz', dataDir, '.']
]) {
  if (archive === 'debian-binary') {
    await writeFile(join(workDir, archive), '2.0\n');
    continue;
  }

  const tarResult = spawnSync(tarBin, [
    '--owner=0',
    '--group=0',
    '-czf',
    join('..', archive),
    target
  ], { cwd, stdio: 'inherit' });

  if (tarResult.status !== 0) {
    throw new Error(`Failed to create ${archive}.`);
  }
}

const ipkName = `${packageName}_${version}-${release}_${arch}.ipk`;
const ipkResult = spawnSync(tarBin, [
  '--owner=0',
  '--group=0',
  '-czf',
  join('..', ipkName),
  './debian-binary',
  './data.tar.gz',
  './control.tar.gz'
], { cwd: workDir, stdio: 'inherit' });

if (ipkResult.status !== 0) {
  throw new Error('IPK package archive failed.');
}

await rm(workDir, { recursive: true, force: true });

const shaResult = spawnSync('shasum', ['-a', '256', `dist/${ipkName}`], { encoding: 'utf8' });
if (shaResult.status === 0) {
  await writeFile(`dist/${ipkName}.sha256`, shaResult.stdout);
}

await cp(`dist/${ipkName}`, `dist/${releaseIpkName}`);
const releaseShaResult = spawnSync('shasum', ['-a', '256', `dist/${releaseIpkName}`], { encoding: 'utf8' });
if (releaseShaResult.status === 0) {
  await writeFile(`dist/${releaseShaName}`, releaseShaResult.stdout);
}

console.log(`Created dist/${packageName}-${version}.tar.gz`);
console.log(`Created dist/${ipkName}`);
console.log(`Created dist/${releaseIpkName}`);
