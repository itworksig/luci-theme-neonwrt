# OpenWrt LuCI Theme: NeonWrt

This workspace contains a lightweight OpenWrt LuCI theme package and a local Mac preview app.

## Local Preview

```sh
npm install
npm run dev
```

Open the Vite URL and iterate on:

- `luci-theme-neonwrt/root/www/luci-static/neonwrt/cascade.css`
- `preview/index.html`
- `preview/preview.js`

## Theme Package Layout

- `luci-theme-neonwrt/Makefile` - OpenWrt package metadata.
- `luci-theme-neonwrt/root/www/luci-static/neonwrt/cascade.css` - Theme stylesheet.
- `luci-theme-neonwrt/luasrc/view/themes/neonwrt/header.htm` - LuCI theme header template.
- `luci-theme-neonwrt/luasrc/view/themes/neonwrt/footer.htm` - LuCI theme footer template.

## Use With OpenWrt SDK

Copy or symlink `luci-theme-neonwrt` into an OpenWrt SDK package feed, then build:

```sh
make package/luci-theme-neonwrt/compile V=s
```

If you already have an SDK extracted locally:

```sh
scripts/build-in-sdk.sh /path/to/openwrt-sdk
```

For a Linux container shell with the common OpenWrt build dependencies:

```sh
docker build -f docker/Dockerfile.openwrt-sdk -t openwrt-theme-sdk .
docker run --rm -it -v "$PWD:/workspace" openwrt-theme-sdk
```

After installing the generated `.ipk`, select the theme in LuCI:

`System -> System -> Language and Style -> Design -> neonwrt`
