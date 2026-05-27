#!/bin/sh
set -eu

docker rm -f openwrt-neonwrt >/dev/null 2>&1 || true
docker run \
  --platform linux/amd64 \
  --name openwrt-neonwrt \
  -p 8080:80 \
  openwrt-neonwrt:latest
