FROM --platform=linux/amd64 openwrt/rootfs:latest

RUN mkdir -p /var/lock /var/run /var/log /tmp/run \
  && apk update \
  && apk add luci uhttpd uhttpd-mod-ucode uhttpd-mod-lua uhttpd-mod-ubus rpcd-mod-file rpcd-mod-luci luci-app-statistics collectd collectd-mod-cpu collectd-mod-interface collectd-mod-load collectd-mod-memory \
  && mkdir -p /www/luci-static/neonwrt /usr/lib/lua/luci/view/themes/neonwrt /etc/config

COPY luci-theme-neonwrt/root/ /
COPY luci-theme-neonwrt/luasrc/view/themes/neonwrt/ /usr/lib/lua/luci/view/themes/neonwrt/
COPY docker/openwrt-neonwrt/root/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
