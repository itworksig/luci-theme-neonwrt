#!/usr/bin/env bash
set -euo pipefail

SDK_DIR="${1:-}"

if [ -z "$SDK_DIR" ]; then
  echo "Usage: scripts/build-in-sdk.sh <openwrt-sdk-dir>"
  exit 1
fi

node scripts/link-theme-to-sdk.mjs "$SDK_DIR"
make -C "$SDK_DIR" defconfig
make -C "$SDK_DIR" package/luci-theme-neonwrt/compile V=s
