// Carte: masthead (date and weather), closing line, and friendlier figures.
// Masthead: today's date and a three-day outlook under the title.
// Weather comes from Open-Meteo (free, no account or key), fetched by the browser and
// cached for 30 minutes. All styling lives in custom.css under #carte-masthead.
(function () {
  // Your location for the three-day outlook (Open-Meteo, no key needed). Rounded coordinates are plenty.
  var LAT = 40.71, LON = -74.01, TZ = 'America/New_York', UNIT = 'fahrenheit'; // or 'celsius'
  var CACHE_KEY = 'carte-weather-v1', CACHE_MINUTES = 30;
  var URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=' + UNIT +
    '&timezone=' + encodeURIComponent(TZ) + '&forecast_days=3';

  // small line icons, drawn with the theme's accent colour
  var CLOUD = '<path d="M17 18a4.5 4.5 0 0 0-1.2-8.8A6 6 0 0 0 4.3 11 3.6 3.6 0 0 0 5.5 18z"/>';
  var HIGH_CLOUD = '<path d="M17 15a4.5 4.5 0 0 0-1.2-8.8A6 6 0 0 0 4.3 8 3.6 3.6 0 0 0 5.5 15z"/>';
  var ICONS = {
    clear: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    partly: CLOUD + '<path d="M17.5 6.5a3 3 0 0 1 3 4.6"/><path d="M19 2.6v1.3M22.9 6.5h-1.3M21.8 3.7l-.9.9"/>',
    cloud: CLOUD,
    fog: HIGH_CLOUD + '<path d="M5 18.5h14M7 21.5h10"/>',
    rain: HIGH_CLOUD + '<path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: HIGH_CLOUD + '<path d="M8 19h.01M12 19h.01M16 19h.01M10 22h.01M14 22h.01"/>',
    storm: HIGH_CLOUD + '<path d="M12.5 16.5l-2.5 3.5h3l-2 3"/>'
  };
  function iconFor(code) { // WMO weather codes
    if (code === 0) return 'clear';
    if (code === 1 || code === 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    if (code >= 51) return 'rain';
    return 'cloud';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function dateText() {
    var d = new Date();
    return d.toLocaleDateString('en-GB', { weekday: 'long' }) + ' · ' +
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function dayLabel(iso, index) {
    if (index === 0) return 'today';
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short' });
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.at < CACHE_MINUTES * 60000) return c.daily;
    } catch (e) {}
    return null;
  }
  function getWeather() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return fetch(URL).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), daily: j.daily })); } catch (e) {}
        return j.daily;
      });
  }

  var lastDaily = null;
  function render() {
    var host = document.getElementById('layout-groups');
    if (!host) return;
    var m = document.getElementById('carte-masthead');
    if (!m) { m = el('div'); m.id = 'carte-masthead'; host.insertBefore(m, host.firstChild); }
    m.textContent = '';
    m.appendChild(el('div', 'cm-date', dateText()));
    var d = lastDaily;
    if (!d || !d.time) return; // no weather yet (or Open-Meteo unreachable): date only
    var row = el('div', 'cm-weather');
    for (var i = 0; i < Math.min(3, d.time.length); i++) {
      var day = el('span', 'cm-day');
      day.appendChild(el('span', 'cm-label', dayLabel(d.time[i], i)));
      var icon = el('span', 'cm-icon');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        ICONS[iconFor(Number(d.weather_code[i]))] + '</svg>';
      day.appendChild(icon);
      day.appendChild(el('span', 'cm-hi', Math.round(d.temperature_2m_max[i]) + '°'));
      day.appendChild(el('span', 'cm-lo', ' / ' + Math.round(d.temperature_2m_min[i]) + '°'));
      row.appendChild(day);
    }
    m.appendChild(row);
  }
  function update() {
    render();
    getWeather().then(function (daily) { lastDaily = daily; render(); }).catch(function () {});
  }

  // Closing line at the foot of the menu: how many services there are and whether any are down.
  // It reads the statuses already on the page, so it makes no requests of its own.
  var lastFooter = '';
  function renderFooter() {
    var host = document.getElementById('layout-groups');
    if (!host || !host.querySelector('.services-group')) return;
    var items = document.querySelectorAll('li.service'), down = [], known = 0;
    for (var i = 0; i < items.length; i++) {
      var s = items[i].querySelector('.site-monitor-status div');
      if (!s) continue;
      var cls = String(s.className || '');
      if (cls.indexOf('rose') !== -1) { down.push(items[i].getAttribute('data-name')); known++; }
      else if (cls.indexOf('emerald') !== -1) known++;
    }
    var status = down.length ? down.length + ' down: ' + down.join(', ') : (known ? 'all up' : '');
    var key = items.length + '|' + status;
    var f = document.getElementById('carte-footer');
    if (f && key === lastFooter && host.lastElementChild === f) return;
    if (!f) { f = el('div'); f.id = 'carte-footer'; }
    f.textContent = '';
    f.appendChild(el('div', 'cf-mark', '❦'));
    var line = el('div', 'cf-line');
    line.appendChild(el('span', 'cf-part', items.length + ' services'));
    if (status) line.appendChild(el('span', 'cf-part ' + (down.length ? 'cf-down' : 'cf-ok'), status));
    line.appendChild(el('span', 'cf-part cf-hint', 'type to search'));
    f.appendChild(line);
    if (host.lastElementChild !== f) host.appendChild(f);
    lastFooter = key;
  }
  setInterval(renderFooter, 3000);

  // Two rewrites of widget figures. The original text stays in the page (hidden by custom.css) and
  // the replacement is displayed from data-f.
  //  - durations: Homepage abbreviates them ("1mo16d"); spell them out ("1 month 16 days")
  //  - sizes: binary units ("38 GiB") become decimal ones ("41 GB"), like the other sizes on the page
  var UNIT_WORDS = { y: 'year', mo: 'month', w: 'week', d: 'day', h: 'hour', m: 'minute', s: 'second' };
  var SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  function rewriteValue(text) {
    if (/^\s*(?:\d+\s*(?:mo|[ywdhms])\s*)+$/.test(text)) {
      return text.replace(/(\d+)\s*(mo|[ywdhms])\s*/g, function (all, n, u) {
        return n + ' ' + UNIT_WORDS[u] + (n === '1' ? '' : 's') + ' ';
      }).trim();
    }
    // a size, or a pair such as the pool rows' "13.4 TiB / 21 TiB"
    var parts = text.split(' / ');
    for (var i = 0; i < parts.length; i++) {
      var m = /^\s*([\d,]+(?:\.\d+)?)\s*([KMGTP])iB\s*$/.exec(parts[i]);
      if (!m) return null;
      var power = 'KMGTP'.indexOf(m[2]) + 1;
      var n = parseFloat(m[1].replace(/,/g, '')) * Math.pow(1.024, power);
      if (n >= 1000) { n /= 1000; power++; }
      var scale = m[1].indexOf('.') < 0 && n >= 10 ? 1 : 10; // no more decimals than Homepage showed
      parts[i] = String(Math.round(n * scale) / scale) + ' ' + SIZE_UNITS[power];
    }
    return parts.join(' / ');
  }
  function rewriteValues() {
    var values = document.querySelectorAll('.service-block-value, ' + // widget figures, and the pool rows' used / total
      '.service-card > div:not(.service-title):not(.service-container) > div:last-child > span:first-child');
    for (var i = 0; i < values.length; i++) {
      var out = rewriteValue(values[i].textContent);
      if (out) {
        if (values[i].getAttribute('data-f') !== out) values[i].setAttribute('data-f', out);
      } else if (values[i].hasAttribute('data-f')) values[i].removeAttribute('data-f');
    }
  }
  setInterval(rewriteValues, 500);

  // Homepage draws the groups after the page loads; wait for them, and put the
  // masthead back if a redraw ever removes it.
  setInterval(function () {
    if (document.querySelector('#layout-groups .services-group') && !document.getElementById('carte-masthead')) update();
  }, 1500);
  setInterval(update, 10 * 60000); // keeps the date and outlook current on a tab left open
})();
