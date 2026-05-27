import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'luci-theme-neonwrt/Makefile',
  'luci-theme-neonwrt/root/www/luci-static/neonwrt/cascade.css',
  'luci-theme-neonwrt/root/usr/share/ucode/luci/template/themes/neonwrt/header.ut',
  'luci-theme-neonwrt/root/usr/share/ucode/luci/template/themes/neonwrt/footer.ut',
  'luci-theme-neonwrt/root/usr/share/ucode/luci/template/themes/neonwrt/sysauth.ut',
  'luci-theme-neonwrt/luasrc/view/themes/neonwrt/header.htm',
  'luci-theme-neonwrt/luasrc/view/themes/neonwrt/footer.htm',
  'preview/index.html'
];

for (const file of requiredFiles) {
  await access(file);
}

const css = await readFile('luci-theme-neonwrt/root/www/luci-static/neonwrt/cascade.css', 'utf8');

for (const token of ['--a-bg', '--a-accent', '.neonwrt-shell', '.cbi-section']) {
  if (!css.includes(token)) {
    throw new Error(`Missing CSS token: ${token}`);
  }
}

console.log('Theme scaffold is valid.');
