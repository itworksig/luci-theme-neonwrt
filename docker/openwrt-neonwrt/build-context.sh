#!/bin/sh
set -eu

docker build \
  -f docker/openwrt-neonwrt/Dockerfile \
  -t openwrt-neonwrt:latest \
  .
