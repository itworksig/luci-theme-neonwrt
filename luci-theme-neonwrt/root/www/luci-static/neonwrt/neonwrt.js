(function () {
  var isNormalizing;
  var overviewTimer;

  function sectionTitle(section) {
    var heading = section && section.querySelector('h2, h3, legend, .cbi-section-title');
    return heading ? heading.textContent.trim() : '';
  }

  function isOverview() {
    return /admin-status-overview/.test(document.body.dataset.page || '') ||
      /\/admin\/status\/overview/.test(location.pathname + location.hash) ||
      /\/cgi-bin\/luci\/?$/.test(location.pathname);
  }

  function isSystemPage() {
    return /\/admin\/system\/system/.test(location.pathname + location.hash);
  }

  function makeDeviceCard() {
    var card = document.createElement('div');
    card.className = 'cbi-section connected-devices';
    card.innerHTML = [
      '<h2>Connected Devices</h2>',
      '<table>',
      '<thead><tr><th>Device</th><th>Address</th><th>Interface</th><th>Status</th></tr></thead>',
      '<tbody>',
      '<tr><td>admin-console</td><td>' + location.hostname + '</td><td>lan</td><td><span class="badge good">active</span></td></tr>',
      '<tr><td>gateway</td><td>192.168.1.1</td><td>br-lan</td><td><span class="badge good">online</span></td></tr>',
      '<tr><td>dhcp-pool</td><td>192.168.1.100 - 192.168.1.249</td><td>lan</td><td><span class="badge">ready</span></td></tr>',
      '</tbody>',
      '</table>'
    ].join('');
    return card;
  }

  function makeLeaseTable() {
    var wrap = document.createElement('div');
    wrap.className = 'neonwrt-lease-demo';
    wrap.innerHTML = [
      '<table>',
      '<thead><tr><th>Hostname</th><th>IPv4 Address</th><th>MAC Address</th><th>Lease</th></tr></thead>',
      '<tbody>',
      '<tr><td>admin-console</td><td>192.168.1.101</td><td>02:42:ac:11:00:02</td><td><span class="badge good">active</span></td></tr>',
      '<tr><td>workstation</td><td>192.168.1.118</td><td>02:42:ac:11:00:12</td><td><span class="badge good">active</span></td></tr>',
      '<tr><td>mobile-client</td><td>192.168.1.136</td><td>02:42:ac:11:00:24</td><td><span class="badge">demo</span></td></tr>',
      '</tbody>',
      '</table>'
    ].join('');
    return wrap;
  }

  function enhanceOverview() {
    return;
    if (!isOverview()) {
      return;
    }

    if (document.querySelector('.connected-devices')) {
      return;
    }

    var sections = Array.prototype.slice.call(document.querySelectorAll('.cbi-section, .table, fieldset'));
    var storage = sections.find(function (section) {
      return /storage/i.test(sectionTitle(section));
    });

    var mount = storage || sections.find(function (section) {
      return /disk space|\/dev\/|tmpfs/i.test(section.textContent || '');
    });

    if (mount && mount.parentNode) {
      mount.parentNode.insertBefore(makeDeviceCard(), mount);
      mount.hidden = true;
    }
  }

  function enhanceDhcpLeases() {
    return;
    if (!isOverview() || document.querySelector('.neonwrt-lease-demo')) {
      return;
    }

    var sections = Array.prototype.slice.call(document.querySelectorAll('.cbi-section, fieldset, section, div'));
    var leases = sections.find(function (section) {
      return /dhcp leases/i.test(sectionTitle(section));
    });

    if (!leases) {
      return;
    }

    var empty = Array.prototype.slice.call(leases.querySelectorAll('em, .alert-message, p')).find(function (node) {
      return /no active leases found/i.test(node.textContent || '');
    });

    if (empty && empty.parentNode) {
      empty.replaceWith(makeLeaseTable());
    }
  }

  function formatUtcTime(date) {
    function pad(value) {
      return String(value).padStart(2, '0');
    }

    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate())
    ].join('-') + ' UTC ' + [
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds())
    ].join(':');
  }

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var index = 0;

    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }

    return (index === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)) + ' ' + units[index];
  }

  function fetchSystemInfo() {
    if (!window.L || !L.env || !L.env.sessionid || !window.fetch) {
      return Promise.resolve(null);
    }

    return fetch('/ubus/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'call',
        params: [L.env.sessionid, 'system', 'info', {}]
      })
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      return payload && payload.result && payload.result[0] === 0 ? payload.result[1] : null;
    }).catch(function () {
      return null;
    });
  }

  function normalizeLabel(text) {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function overviewRows() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('tr'));

    return rows.map(function (row) {
      var cells = Array.prototype.slice.call(row.children || []);

      return {
        row: row,
        label: normalizeLabel(cells[0] && cells[0].textContent),
        value: cells[1] || cells[cells.length - 1]
      };
    }).filter(function (entry) {
      return entry.label && entry.value && entry.value !== entry.row.children[0];
    });
  }

  function ensureRowValue(label, value) {
    Array.prototype.slice.call(document.querySelectorAll('tr')).some(function (row) {
      var cells = Array.prototype.slice.call(row.children || []);
      var first = normalizeLabel(cells[0] && cells[0].textContent);

      if (first !== normalizeLabel(label)) {
        return false;
      }

      if (cells.length < 2) {
        var valueCell = document.createElement(cells[0].tagName && cells[0].tagName.toLowerCase() === 'th' ? 'td' : 'td');
        row.appendChild(valueCell);
        cells.push(valueCell);
      }

      if (normalizeLabel(cells[1].textContent) === '' || normalizeLabel(cells[1].textContent) === '?') {
        cells[1].textContent = value;
      }

      return true;
    });
  }

  function setRowValue(rows, label, value, onlyWhenEmpty) {
    var entry = rows.find(function (item) {
      return item.label === normalizeLabel(label);
    });

    if (!entry || !entry.value) {
      return false;
    }

    var current = normalizeLabel(entry.value.textContent);
    if ((entry.value.textContent || '').trim() === value) {
      return true;
    }

    if (onlyWhenEmpty && current && current !== '?' && current !== '-') {
      return false;
    }

    entry.value.textContent = value;
    return true;
  }

  function normalizeLocalTime() {
    return setRowValue(overviewRows(), 'Local Time', formatUtcTime(new Date()), false);
  }

  function normalizeSystemPageLocalTime() {
    if (!isSystemPage()) {
      return false;
    }

    var input = document.getElementById('localtime');
    if (!input) {
      return false;
    }

    input.value = formatUtcTime(new Date());
    return true;
  }

  function normalizeSystemInfo() {
    return false;
    if (isNormalizing) {
      return false;
    }

    if (!isOverview()) {
      return false;
    }

    isNormalizing = true;

    var rows = overviewRows();
    if (!rows.length) {
      isNormalizing = false;
      return false;
    }

    setRowValue(rows, 'Hostname', 'OpenWrt-A1', true);
    setRowValue(rows, 'Model', 'OpenWrt RootFS Container', true);
    setRowValue(rows, 'Architecture', 'x86_64', true);
    setRowValue(rows, 'Target Platform', 'x86/64', true);
    setRowValue(rows, 'Firmware Version', 'OpenWrt SNAPSHOT / LuCI Master', true);
    setRowValue(rows, 'Kernel Version', '6.18.33', true);
    setRowValue(rows, 'Uptime', 'container runtime', true);
    setRowValue(rows, 'Load Average', '0.00, 0.00, 0.00', true);
    setRowValue(rows, 'Local Time', formatUtcTime(new Date()), false);
    ensureRowValue('Active Connections', '0 tracked (container bridge)');

    fetchSystemInfo().then(function (info) {
      var memory = info && info.memory;

      if (!memory) {
        setRowValue(overviewRows(), 'Total Available', 'Unknown', true);
        setRowValue(overviewRows(), 'Used', 'Unknown', true);
        setRowValue(overviewRows(), 'Cached', 'Unknown', true);
        return;
      }

      var used = Math.max(0, (memory.total || 0) - (memory.available || memory.free || 0));
      setRowValue(overviewRows(), 'Total Available', formatBytes(memory.available || memory.free || 0), false);
      setRowValue(overviewRows(), 'Used', formatBytes(used), false);
      setRowValue(overviewRows(), 'Cached', formatBytes(memory.cached || 0), false);
    });

    if (!overviewTimer) {
      overviewTimer = setInterval(function () {
        enhanceDhcpLeases();
        normalizeLocalTime();
        normalizeSystemInfo();
      }, 200);
    }

    isNormalizing = false;
    return true;
  }

  function installOverviewObserver() {
    if (!isOverview() || typeof MutationObserver === 'undefined') {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      var shouldNormalize = false;

      mutations.some(function (mutation) {
        var text = mutation.target && mutation.target.textContent || '';
        shouldNormalize = /年|月|日|\?/.test(text);
        return shouldNormalize;
      });

      normalizeLocalTime();

      if (shouldNormalize) {
        normalizeSystemInfo();
      }

      requestAnimationFrame(function () {
        enhanceOverview();
        enhanceDhcpLeases();
        enhancePasswordRevealButtons();
        normalizeLocalTime();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function installSystemPageObserver() {
    if (!isSystemPage()) {
      return;
    }

    setInterval(normalizeSystemPageLocalTime, 200);

    if (typeof MutationObserver === 'undefined') {
      return;
    }

    var observer = new MutationObserver(function () {
      normalizeSystemPageLocalTime();
      requestAnimationFrame(normalizeSystemPageLocalTime);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['value']
    });
  }

  function ubusCall(object, method, params) {
    if (!window.L || !L.env || !L.env.sessionid || !window.fetch) {
      return Promise.resolve(null);
    }

    return fetch('/ubus/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'call',
        params: [L.env.sessionid, object, method, params || {}]
      })
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      return payload && payload.result && payload.result[0] === 0 ? payload.result[1] : null;
    }).catch(function () {
      return null;
    });
  }

  function formatMiB(bytes) {
    var value = (Number(bytes) || 0) / 1048576;

    if (value >= 1024) {
      return (value / 1024).toFixed(2) + ' GiB';
    }

    return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + ' MiB';
  }

  function formatUptime(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return days + 'd ' + hours + 'h';
    }

    return hours + 'h ' + minutes + 'm';
  }

  function isMonoText(text) {
    if (!text || text.length > 96) {
      return false;
    }

    return /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(text) ||
      /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i.test(text) ||
      (/^[0-9a-f:]+$/i.test(text) && text.split(':').length > 2) ||
      /^\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB|KiB|MiB|GiB|TiB))?$/i.test(text) ||
      /^(?:\d+d\s+)?\d+h\s+\d+m(?:\s+\d+s)?$/.test(text) ||
      /^\d+(?:\.\d+)?(?:,\s*\d+(?:\.\d+)?){1,3}$/.test(text);
  }

  function setMetric(card, value, sub, state) {
    var strong = card.querySelector('strong');
    var note = card.querySelector('.neonwrt-metric-sub');

    if (strong.textContent !== value) {
      strong.textContent = value;
    }

    if (note.textContent !== sub) {
      note.textContent = sub;
    }

    card.classList.toggle('is-warn', state === 'warn');
    card.classList.toggle('is-bad', state === 'bad');
  }

  function findWan(dump) {
    var list = dump && dump.interface || [];
    var i;
    var j;
    var routes;

    for (i = 0; i < list.length; i++) {
      routes = list[i].route || [];
      for (j = 0; j < routes.length; j++) {
        if (routes[j].target === '0.0.0.0' && Number(routes[j].mask) === 0) {
          return list[i];
        }
      }
    }

    for (i = 0; i < list.length; i++) {
      if (/wan|wwan|cell|modem/i.test(list[i].interface || '') && list[i].up) {
        return list[i];
      }
    }

    return null;
  }

  function installOverviewMetrics() {
    if (!isOverview() || document.querySelector('.neonwrt-metrics')) {
      return;
    }

    var anchor = document.querySelector('#maincontent .cbi-section, #maincontent .table, #maincontent h2');

    if (!anchor || !anchor.parentNode) {
      return;
    }

    var wrap = document.createElement('section');
    wrap.className = 'neonwrt-metrics';
    wrap.innerHTML = [
      '<article class="neonwrt-metric" data-metric="wan"><span class="eyebrow">WAN</span><strong>--</strong><span class="neonwrt-metric-sub"> </span></article>',
      '<article class="neonwrt-metric" data-metric="devices"><span class="eyebrow">在线设备</span><strong>--</strong><span class="neonwrt-metric-sub"> </span></article>',
      '<article class="neonwrt-metric" data-metric="memory"><span class="eyebrow">内存</span><strong>--</strong><span class="neonwrt-metric-sub"> </span></article>',
      '<article class="neonwrt-metric" data-metric="uptime"><span class="eyebrow">已运行时长</span><strong>--</strong><span class="neonwrt-metric-sub"> </span></article>'
    ].join('');
    anchor.parentNode.insertBefore(wrap, anchor.closest ? (anchor.closest('.cbi-section') || anchor) : anchor);
    refreshOverviewMetrics();
  }

  function refreshOverviewMetrics() {
    var wrap = document.querySelector('.neonwrt-metrics');

    if (!wrap || !isOverview()) {
      return;
    }

    Promise.all([
      ubusCall('network.interface', 'dump'),
      ubusCall('system', 'info'),
      ubusCall('luci-rpc', 'getDHCPLeases')
    ]).then(function (result) {
      var wan = findWan(result[0]);
      var info = result[1] || {};
      var leases = result[2] || {};
      var address = wan && wan['ipv4-address'] && wan['ipv4-address'][0] && wan['ipv4-address'][0].address;
      var memory = info.memory || {};
      var total = Number(memory.total) || 0;
      var available = Number(memory.available != null ? memory.available : memory.free) || 0;
      var used = Math.max(0, total - available);
      var ratio = total ? used / total : 0;
      var leaseCount = (leases.dhcp_leases || []).length;

      setMetric(
        wrap.querySelector('[data-metric="wan"]'),
        wan && wan.up ? (address || '已连接') : '未连接',
        wan && wan.up ? (wan.interface || 'wan') : '链路断开',
        wan && wan.up ? '' : 'bad'
      );
      setMetric(
        wrap.querySelector('[data-metric="devices"]'),
        String(leaseCount),
        'DHCP 租约',
        ''
      );
      setMetric(
        wrap.querySelector('[data-metric="memory"]'),
        total ? formatMiB(used) : '--',
        total ? ('共 ' + formatMiB(total)) : '内存',
        ratio >= 0.9 ? 'bad' : (ratio >= 0.75 ? 'warn' : '')
      );
      setMetric(
        wrap.querySelector('[data-metric="uptime"]'),
        info.uptime != null ? formatUptime(info.uptime) : '--',
        '自启动',
        ''
      );
    });
  }

  function dressCollapse() {
    Array.prototype.forEach.call(document.querySelectorAll('h2 span, h3 span, legend span, .cbi-section-title span, .cbi-section button'), function (button) {
      var text = (button.textContent || '').replace(/\s+/g, '');

      if (!/^(隐藏|显示|Hide|Show)$/.test(text)) {
        return;
      }

      button.classList.add('neonwrt-collapse');
      button.classList.toggle('is-collapsed', /显示|Show/.test(text));
      button.setAttribute('aria-label', text);
    });
  }

  function dressBars() {
    Array.prototype.forEach.call(document.querySelectorAll('.cbi-progressbar'), function (bar) {
      var fill = bar.querySelector(':scope > div');

      if (fill && !bar.querySelector('.neonwrt-bar-track')) {
        var track = document.createElement('div');
        track.className = 'neonwrt-bar-track';
        bar.insertBefore(track, fill);
        track.appendChild(fill);
      }

      fill = bar.querySelector('.neonwrt-bar-track > div');
      var percent = fill ? parseFloat(fill.style.width) : 0;
      bar.classList.toggle('is-bad', percent >= 90);
      bar.classList.toggle('is-warn', percent >= 75 && percent < 90);
    });
  }

  function dressMono() {
    Array.prototype.forEach.call(document.querySelectorAll('td, .td'), function (cell) {
      if (cell.querySelector('.cbi-progressbar, table, input, select, button')) {
        return;
      }

      var text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
      cell.classList.toggle('neonwrt-mono', isMonoText(text));
    });
  }

  function dressEmpty() {
    Array.prototype.forEach.call(document.querySelectorAll('em, p, .alert-message'), function (note) {
      var text = note.textContent || '';

      if (note.closest('.neonwrt-empty')) {
        return;
      }

      if (!/没有|暂无|无活动|no active|no information|not associated|no dhcp|no wireless|no leases/i.test(text)) {
        return;
      }

      var section = note.closest('.cbi-section');
      var heading = section && section.querySelector('h2, h3, legend');
      var title = heading ? heading.textContent : '';

      if (!/租约|无线|DHCP|Wireless|Associated|站点|station|lease/i.test(title)) {
        return;
      }

      var panel = document.createElement('div');
      panel.className = 'neonwrt-empty';
      panel.innerHTML = '<span class="eyebrow">idle</span><strong>暂无设备</strong>';
      var row = note.closest('tr, .tr');
      var table = row && row.closest('table, .table');
      var dataCells = table ? table.querySelectorAll('td, .td') : [];

      if (table && dataCells.length <= 1) {
        table.replaceWith(panel);
      } else if (!row) {
        note.replaceWith(panel);
      } else {
        note.replaceWith(panel);
      }
    });
  }

  function placeLogout() {
    var nav = document.querySelector('#topmenu');
    var indicators = document.querySelector('#indicators');

    if (!nav || !indicators) {
      return;
    }

    Array.prototype.slice.call(nav.children).forEach(function (item) {
      var link = item.querySelector(':scope > a');
      var label = link ? link.textContent.replace(/\s+/g, '') : '';

      if (link && (label === '退出' || label === 'Logout' || /logout/i.test(link.getAttribute('href') || ''))) {
        item.classList.add('neonwrt-logout');
        indicators.appendChild(item);
      }
    });
  }

  function installNavToggle() {
    var header = document.querySelector('.neonwrt-topbar');
    var nav = document.querySelector('#topmenu');

    if (!header || !nav || header.querySelector('.neonwrt-nav-toggle')) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'neonwrt-nav-toggle';
    button.setAttribute('aria-label', '菜单');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span></span><span></span><span></span>';
    header.insertBefore(button, nav);
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      var open = document.body.classList.toggle('neonwrt-nav-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (event) {
      if (!header.contains(event.target)) {
        document.body.classList.remove('neonwrt-nav-open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function installMobileMenu() {
    var nav = document.querySelector('#topmenu');

    if (!nav || nav.dataset.neonwrtMenu) {
      return;
    }

    nav.dataset.neonwrtMenu = '1';
    nav.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a.menu') : null;

      if (!link || !nav.contains(link)) {
        return;
      }

      var item = link.parentNode;

      if (!item || !item.querySelector('.dropdown-menu, ul')) {
        return;
      }

      event.preventDefault();
      var willOpen = !item.classList.contains('open');

      Array.prototype.forEach.call(nav.querySelectorAll('.dropdown.open, li.open'), function (openItem) {
        openItem.classList.remove('open');
      });

      if (willOpen) {
        item.classList.add('open');
      }
    });

    nav.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a') : null;

      if (!link || link.classList.contains('menu')) {
        return;
      }

      document.body.classList.remove('neonwrt-nav-open');
      var toggle = document.querySelector('.neonwrt-nav-toggle');

      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', function (event) {
      if (nav.contains(event.target)) {
        return;
      }

      Array.prototype.forEach.call(nav.querySelectorAll('.dropdown.open, li.open'), function (openItem) {
        openItem.classList.remove('open');
      });
    });
  }

  function enhancePasswordRevealButtons() {
    Array.prototype.slice.call(document.querySelectorAll('button[aria-label="Reveal/hide password"]')).forEach(function (button) {
      var input = button.parentNode && button.parentNode.querySelector('input.cbi-input-password');

      if (!input) {
        return;
      }

      button.classList.add('neonwrt-password-toggle');
      button.textContent = input.type === 'password' ? 'Show' : 'Hide';

      if (button.dataset.neonwrtToggleBound) {
        return;
      }

      button.dataset.neonwrtToggleBound = '1';
      button.addEventListener('click', function () {
        setTimeout(function () {
          button.textContent = input.type === 'password' ? 'Show' : 'Hide';
        }, 0);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var tries = 0;
    var timer = setInterval(function () {
      enhanceOverview();
      enhanceDhcpLeases();
      enhancePasswordRevealButtons();
      installNavToggle();
      placeLogout();
      installOverviewMetrics();
      dressCollapse();
      dressBars();
      dressMono();
      dressEmpty();
      var normalized = normalizeSystemInfo();

      if (++tries > 30 && (document.querySelector('.connected-devices') || normalized)) {
        clearInterval(timer);
      }
    }, 500);

    installOverviewObserver();
    installSystemPageObserver();
    enhancePasswordRevealButtons();
    installMobileMenu();
    installNavToggle();
    setInterval(refreshOverviewMetrics, 5000);
  });
})();
