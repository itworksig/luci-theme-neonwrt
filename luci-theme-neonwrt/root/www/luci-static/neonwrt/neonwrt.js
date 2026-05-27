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
      var normalized = normalizeSystemInfo();

      if (++tries > 30 && (document.querySelector('.connected-devices') || normalized)) {
        clearInterval(timer);
      }
    }, 500);

    installOverviewObserver();
    installSystemPageObserver();
    enhancePasswordRevealButtons();
  });
})();
