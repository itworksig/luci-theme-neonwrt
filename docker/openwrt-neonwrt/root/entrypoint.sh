#!/bin/sh
set -eu

mkdir -p /var/lock /var/run /var/log /tmp/run /www/luci-static/neonwrt
hostname OpenWrt-A1 2>/dev/null || true

if [ ! -s /etc/config/system ]; then
  cat > /etc/config/system <<'EOF'
config system
	option hostname 'OpenWrt-A1'
	option timezone 'UTC'
	option zonename 'UTC'
	option ttylogin '0'
	option log_size '64'
	option urandom_seed '0'

config timeserver 'ntp'
	option enabled '1'
	option enable_server '0'
	list server '0.openwrt.pool.ntp.org'
	list server '1.openwrt.pool.ntp.org'
	list server '2.openwrt.pool.ntp.org'
	list server '3.openwrt.pool.ntp.org'
EOF
fi

if [ ! -s /etc/config/network ]; then
  cat > /etc/config/network <<'EOF'
config interface 'loopback'
	option device 'lo'
	option proto 'static'
	option ipaddr '127.0.0.1'
	option netmask '255.0.0.0'

config globals 'globals'
	option ula_prefix 'fd42:4242:4242::/48'

config interface 'lan'
	option device 'eth0'
	option proto 'none'
EOF
fi

uci -q batch <<'EOF' || true
set luci.main.mediaurlbase='/luci-static/neonwrt'
set luci.main.lang='en'
set luci.themes.NeonWrt='/luci-static/neonwrt'
commit luci
set uhttpd.main.rfc1918_filter='0'
commit uhttpd
EOF

uci -q batch <<'EOF' || true
set system.@system[0].hostname='OpenWrt-A1'
commit system
EOF

if ! grep -q '^root:' /etc/passwd; then
  echo 'root:x:0:0:root:/root:/bin/ash' >> /etc/passwd
fi

if [ -f /etc/shadow ]; then
  sed -i 's#^root:[^:]*:#root:$1$$sF9Mf5ZRR6sbKV6GiNVmd/:#' /etc/shadow
else
  printf 'root:$1$$sF9Mf5ZRR6sbKV6GiNVmd/:20600:0:99999:7:::\n' > /etc/shadow
fi

ubusd >/tmp/ubusd.log 2>&1 &
sleep 1
procd >/tmp/procd.log 2>&1 &
sleep 1
netifd >/tmp/netifd.log 2>&1 &
sleep 1
rpcd >/tmp/rpcd.log 2>&1 &
sleep 1
collectd -f >/tmp/collectd.log 2>&1 &
uhttpd -f \
  -p 0.0.0.0:80 \
  -h /www \
  -x /cgi-bin \
  -o /cgi-bin/luci \
  -O /usr/share/ucode/luci/uhttpd.uc \
  -u /ubus \
  -U /var/run/ubus/ubus.sock \
  -r OpenWrt-A1 \
  >/tmp/uhttpd.log 2>&1 &

tail -f /dev/null
