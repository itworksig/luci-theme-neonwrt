# OpenWrt Theme Development On Mac M1 Pro

For theme work, this repository uses a lightweight workflow first:

1. Develop CSS and LuCI templates locally with Vite.
2. Package the theme directory.
3. Build an `.ipk` with an OpenWrt SDK or copy files to a test router.

Full OpenWrt firmware builds on Apple Silicon are possible, but they are slower and more fragile than using the SDK or a Linux VM/container. For theme iteration, the SDK path is usually enough.

## Container Build Shell

Docker is available on this Mac, so the repository includes a Debian-based build shell:

```sh
docker build -f docker/Dockerfile.openwrt-sdk -t openwrt-theme-sdk .
docker run --rm -it -v "$PWD:/workspace" openwrt-theme-sdk
```

Inside the container, extract an OpenWrt SDK under `/workspace/openwrt-sdk/...`, then run:

```sh
scripts/build-in-sdk.sh /workspace/openwrt-sdk/<sdk-directory>
```

This keeps Linux-only build assumptions out of macOS while still letting you edit files normally on the Mac.

## Fast Router Test

Copy files to a test router:

```sh
scp -r luci-theme-neonwrt/root/www/luci-static/neonwrt root@192.168.1.1:/www/luci-static/
scp -r luci-theme-neonwrt/luasrc/view/themes/neonwrt root@192.168.1.1:/usr/lib/lua/luci/view/themes/
```

Then select `neonwrt` in LuCI under language and style settings.
