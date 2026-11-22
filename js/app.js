/* Hello Dorking town-centre map sample (MapLibre GL / Mapbox GL compatible) */
(function () {
  'use strict';

  // ---- Library switch: MapLibre today, Mapbox later (same API) ----
  var gl = window.MAP_PROVIDER.library === 'mapbox' ? window.mapboxgl : window.maplibregl;
  if (window.MAP_PROVIDER.library === 'mapbox') gl.accessToken = window.MAP_PROVIDER.mapboxToken;

  var LAYERS = window.LAYERS, ICONS = window.ICONS;
  var state = {};            // layerId -> { visible, markers:[{marker, category}], hiddenCats:{} }
  var openPopup = null;

  var map = new gl.Map({
    container: 'map',
    style: window.BASEMAPS.map.style,
    center: window.MAP_START.center,
    zoom: window.MAP_START.zoom,
    attributionControl: false
  });
  map.addControl(new gl.NavigationControl({ visualizePitch: false }), 'top-right');
  map.addControl(new gl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'top-right');
  map.addControl(new gl.ScaleControl({ unit: 'imperial' }), 'bottom-right');
  map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');

  // ---------- newsletter, Tell us, GoatCounter ----------
  var tellUsLink = document.getElementById('tell-us');
  var tellUs = window.TELL_US || { email: '', subject: '', body: '' };
  function tellUsHref(placeName) {
    var subject = tellUs.subject || 'Surrey Hills map: correction or idea';
    var body = tellUs.body || 'Place name:\nWhat should change / your idea:\n';
    if (placeName) {
      subject += ' — ' + placeName;
      body = 'Place name: ' + placeName + '\nWhat should change / your idea:\n';
    }
    return 'mailto:' + tellUs.email +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }
  function setTellUsLink(placeName) {
    if (tellUsLink && tellUs.email) tellUsLink.href = tellUsHref(placeName);
  }
  setTellUsLink(null);

  (function initNewsletter() {
    var nl = window.NEWSLETTER || {};
    var cta = document.getElementById('newsletter');
    var panel = document.getElementById('newsletter-panel');
    var show = !!nl.enabled;
    [cta, panel].forEach(function (el) {
      if (!el) return;
      el.hidden = !show;
      if (show && nl.url) el.href = nl.url;
    });
    if (show && nl.text) {
      var longEl = cta && cta.querySelector('.cta-long');
      if (longEl) longEl.textContent = nl.text;
      var panelSpan = panel && panel.querySelector('span');
      if (panelSpan) panelSpan.textContent = nl.text + ' →';
    }
  })();

  (function initGoatCounter() {
    var raw = (window.ANALYTICS && window.ANALYTICS.goatcounterCode) || '';
    var code = String(raw).trim().replace(/[^a-z0-9_-]/gi, '');
    if (!code) return;
    window.goatcounter = {
      path: function () {
        var place = new URLSearchParams(location.search).get('place');
        var base = location.pathname || '/';
        return place ? base + '?place=' + encodeURIComponent(place) : base;
      }
    };
    var s = document.createElement('script');
    s.async = true;
    s.src = '//gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    document.head.appendChild(s);
  })();

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(name) {
    var s = String(name == null ? '' : name);
    if (s.normalize) s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    s = s.toLowerCase();
    s = s.replace(/['\u2018\u2019\u201b\u2032`]/g, '');
    s = s.replace(/&/g, ' and ');
    s = s.replace(/[^a-z0-9]+/g, '-');
    s = s.replace(/-+/g, '-');
    s = s.replace(/^-|-$/g, '');
    return s;
  }
  function businessFromUrl() {
    try {
      var params = new URLSearchParams(location.search);
      var q = params.get('b') || params.get('place');
      if (q && String(q).trim()) return String(q).trim();
    } catch (e) {}
    var hash = location.hash || '';
    var m = /^#b=([^&]+)/i.exec(hash);
    if (m) {
      try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); }
      catch (e) { return m[1]; }
    }
    return null;
  }
  function svgIcon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICONS[name] || ICONS.landmark) + '"/></svg>';
  }
  function colourFor(layer, row) {
    if (layer.categoryField && layer.categories) {
      return layer.categories[row[layer.categoryField]] || layer.colour;
    }
    return layer.colour;
  }
  function iconFor(layer, row) {
    if (layer.categoryField && layer.categoryIcons) {
      return layer.categoryIcons[row[layer.categoryField]] || layer.icon;
    }
    return layer.icon;
  }
  // optional display labels for categories, e.g. Tier 'Main' -> 'Main car park'
  function catLabel(layer, cat) { return (layer.categoryLabels && layer.categoryLabels[cat]) || cat; }
  function isUrl(s) { return /^https?:\/\//i.test(String(s || '').trim()); }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'Website'; } }

  function popupHtml(layer, row, colour) {
    var f = layer.fields, v = function (k) {
      var cols = f[k] ? [].concat(f[k]) : [];
      return cols.map(function (c) { return (row[c] || '').trim(); }).filter(Boolean).join(' ');
    };
    var lat = row.Latitude, lng = row.Longitude;
    var cat = v('subcategory') || (layer.categoryField ? catLabel(layer, row[layer.categoryField]) : layer.name);
    var photo = v('photo');
    var h = '<div class="pop">';
    if (photo) {
      h += '<div class="pop-photo"><img src="' + esc(photo) + '" alt="" width="1200" height="800"></div>';
      if (v('photoCredit')) h += '<p class="pop-photo-credit">' + esc(v('photoCredit')) + '</p>';
    }
    h += '<div class="pop-body">';
    h += '<div class="pop-cat" style="color:' + colour + '"><span class="pop-dot" style="background:' + colour + '"></span>' + esc(cat);
    if (/^y$/i.test(v('independent'))) h += '<span class="pop-badge">Independent</span>';
    h += '</div>';
    h += '<h3>' + esc(v('name')) + '</h3>';
    if (v('description')) h += '<p class="pop-desc">' + esc(v('description')) + '</p>';
    if (v('hours')) h += '<p class="pop-meta"><strong>Opening hours</strong> ' + esc(v('hours')) + '</p>';
    if (v('address')) h += '<p class="pop-addr">' + esc(v('address')) + '</p>';
    if (/approx|postcode centroid|^street\b|uncertain|weak address|fell back to postcode/i.test(v('precision'))) h += '<p class="pop-approx">Approximate location</p>';
    h += '<div class="pop-actions">';
    h += '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' +
         encodeURIComponent(lat + ',' + lng) + '">Directions</a>';
    if (v('phone')) h += '<a class="btn" href="tel:' + esc(v('phone').replace(/\s+/g, '')) + '">Call</a>';
    if (isUrl(v('website'))) h += '<a class="btn" target="_blank" rel="noopener" href="' + esc(v('website')) + '">Website ↗</a>';
    if (isUrl(v('instagram'))) h += '<a class="btn" target="_blank" rel="noopener" href="' + esc(v('instagram')) + '">Instagram ↗</a>';
    else if (v('instagram')) h += '<a class="btn" target="_blank" rel="noopener" href="https://www.instagram.com/' +
      esc(v('instagram').replace(/^@/, '')) + '/">Instagram ↗</a>';
    h += '</div></div></div>';
    return h;
  }

  // Pan so an open pop-up (drawn above its pin) is fully visible and clear of the legend
  function fitPopup(popup, lnglat) {
    var pe = popup.getElement(); if (!pe) return;
    var c = map.getContainer(), W = c.clientWidth, H = c.clientHeight;
    var ph = pe.getBoundingClientRect().height, pw = pe.getBoundingClientRect().width;
    var lg = document.getElementById('legend');
    var leftPad = (window.innerWidth >= 760 && lg.classList.contains('open')) ? lg.offsetWidth + 32 : 0;
    var p = map.project(lnglat);
    var targetX = leftPad + (W - leftPad) / 2;
    var targetY = Math.min(H - 30, Math.max(ph + 60, H * 0.55));
    var dx = p.x - targetX, dy = p.y - targetY;
    // only move if the pop-up would be clipped or under the legend
    var clipped = (p.y - ph - 50 < 0) || (p.x - pw / 2 < leftPad + 10) || (p.x + pw / 2 > W - 60) || (p.y > H - 20);
    if (clipped) map.panBy([dx, dy], { duration: 350 });
  }

  // ---------- markers ----------
  function addMarkers(layer, rows) {
    var st = state[layer.id];
    rows.forEach(function (row) {
      var lat = parseFloat(row.Latitude), lng = parseFloat(row.Longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      var colour = colourFor(layer, row);
      var el = document.createElement('button');
      var cat = layer.categoryField ? row[layer.categoryField] : null;
      // optional per-category pin style, e.g. smaller pins for small car parks
      el.className = 'pin' + (cat && layer.categoryPinClass && layer.categoryPinClass[cat] ? ' ' + layer.categoryPinClass[cat] : '');
      var small = /\bpin-sm\b/.test(el.className);
      el.type = 'button';
      el.setAttribute('aria-label', row[layer.fields.name] || layer.name);
      el.title = row[layer.fields.name] || '';
      el.style.setProperty('--c', colour);
      el.innerHTML = '<span class="pin-body">' + svgIcon(iconFor(layer, row), small ? 12 : 15) + '</span>';
      var popup = new gl.Popup({ offset: [0, small ? -28 : -36], anchor: 'bottom', maxWidth: '340px', closeButton: true, focusAfterOpen: false })
        .setHTML(popupHtml(layer, row, colour));
      popup.on('open', function () {
        openPopup = popup; el.classList.add('active');
        setTellUsLink(row[layer.fields.name] || '');
        requestAnimationFrame(function () { fitPopup(popup, [lng, lat]); });
      });
      popup.on('close', function () {
        el.classList.remove('active');
        if (openPopup === popup) { openPopup = null; setTellUsLink(null); }
      });
      var marker = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).setPopup(popup).addTo(map);
      marker._dkName = row[layer.fields.name];
      marker._dkPopOffset = small ? [0, -28] : [0, -36];
      var placeName = row[layer.fields.name] || '';
      st.markers.push({ marker: marker, category: layer.categoryField ? row[layer.categoryField] : null, lnglat: [lng, lat], colour: colour, layerId: layer.id, name: placeName, slug: slugify(placeName), search: (placeName + ' ' + (row.Address || '') + ' ' + (row.Subcategory || '') + ' ' + (row.Kind || '') + ' ' + (row.Stay || '')).toLowerCase() });
    });
  }
  function isShown(st, m) { return st.visible && !(m.category && st.hiddenCats[m.category]); }
  function refreshVisibility(layerId) {
    var st = state[layerId];
    st.markers.forEach(function (m) {
      if (!isShown(st, m) && m.marker.getPopup().isOpen()) m.marker.togglePopup();
    });
    recluster();
  }

  // ---------- grouping of overlapping pins ----------
  // Pins closer than CLUSTER_PX on screen are drawn as one count bubble; tapping it
  // zooms in on them. From FAN_ZOOM up (or where places share one spot) the group
  // fans out in a small circle around its true position, with thin leader lines.
  var CLUSTER_PX = 26, BUBBLE_PX = 36, FAN_ZOOM = 16.4, POP_OFFSET = [0, -36];
  var groupEls = [];
  function clearGroups() { groupEls.forEach(function (g) { g.remove(); }); groupEls = []; }
  function setPinOffset(m, dx, dy) {
    m.marker.setOffset([dx, dy]);
    var po = m.marker._dkPopOffset || POP_OFFSET;
    m.marker.getPopup().setOffset([po[0] + dx, po[1] + dy]);
  }
  function fanOut(members, centre) {
    var n = members.length, r = Math.max(30, Math.round(42 * n / (2 * Math.PI)));
    var size = 2 * r + 12, legs = '';
    members.forEach(function (m, i) {
      var a = n === 2 ? (i ? 0 : Math.PI) : (-Math.PI / 2 + i * 2 * Math.PI / n);
      var dx = Math.round(r * Math.cos(a)), dy = Math.round(r * Math.sin(a));
      setPinOffset(m, dx, dy);
      m.marker.getElement().style.display = '';
      legs += '<line x1="' + size / 2 + '" y1="' + size / 2 + '" x2="' + (size / 2 + dx) + '" y2="' + (size / 2 + dy) + '"/>';
    });
    var el = document.createElement('div');
    el.className = 'spider';
    el.innerHTML = '<svg width="' + size + '" height="' + size + '">' + legs +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="4"/></svg>';
    var mk = new gl.Marker({ element: el, anchor: 'center' }).setLngLat(centre).addTo(map);
    var cc = map.getCanvasContainer(), cv = map.getCanvas();
    cc.insertBefore(el, cv.nextSibling);   // keep the legs underneath the pins
    groupEls.push(mk);
  }
  function bubble(members, centre) {
    members.forEach(function (m) { m.marker.getElement().style.display = 'none'; m.clustered = true; });
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'cluster';
    el.setAttribute('aria-label', members.length + ' places here: tap to zoom in');
    el.title = members.map(function (m) { return m.marker._dkName; }).join(', ');
    // a ring of the member colours, so the bubble hints at what is inside
    var cols = members.map(function (m) { return m.colour; });
    var stops = cols.map(function (c, i) { return c + ' ' + (i * 100 / cols.length) + '% ' + ((i + 1) * 100 / cols.length) + '%'; });
    el.style.setProperty('--ring', 'conic-gradient(' + stops.join(',') + ')');
    el.innerHTML = '<span>' + members.length + '</span>';
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = new gl.LngLatBounds();
      members.forEach(function (m) { b.extend(m.lnglat); });
      var pad = Math.min(90, map.getContainer().clientWidth / 5);
      map.fitBounds(b, { padding: pad, maxZoom: FAN_ZOOM + 0.5, duration: 450 });
    });
    groupEls.push(new gl.Marker({ element: el, anchor: 'center' }).setLngLat(centre).addTo(map));
  }
  function recluster() {
    clearGroups();
    var items = [];
    for (var id in state) {
      state[id].markers.forEach(function (m) {
        m.clustered = false;
        setPinOffset(m, 0, 0);
        if (isShown(state[id], m)) { m.p = map.project(m.lnglat); items.push(m); }
        else m.marker.getElement().style.display = 'none';
      });
    }
    // pass 1: pins closer than CLUSTER_PX join the first pin's group
    var used = [], zoom = map.getZoom(), groups = [];
    for (var i = 0; i < items.length; i++) {
      if (used[i]) continue;
      var seed = items[i], g = [seed]; used[i] = true;
      for (var j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        var dx = items[j].p.x - seed.p.x, dy = items[j].p.y - seed.p.y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) { g.push(items[j]); used[j] = true; }
      }
      groups.push(g);
    }
    // pass 2: a bubble must not cover a pin or another bubble, so merge those that touch
    function gc(g) { var x = 0, y = 0; g.forEach(function (m) { x += m.p.x; y += m.p.y; }); return { x: x / g.length, y: y / g.length }; }
    var merged = true;
    while (merged && zoom < FAN_ZOOM) {
      merged = false;
      for (var a = 0; a < groups.length && !merged; a++) {
        for (var b2 = a + 1; b2 < groups.length; b2++) {
          if (groups[a].length === 1 && groups[b2].length === 1) continue;
          var ca = gc(groups[a]), cb = gc(groups[b2]);
          if ((ca.x - cb.x) * (ca.x - cb.x) + (ca.y - cb.y) * (ca.y - cb.y) < BUBBLE_PX * BUBBLE_PX) {
            groups[a] = groups[a].concat(groups[b2]); groups.splice(b2, 1); merged = true; break;
          }
        }
      }
    }
    for (var gi = 0; gi < groups.length; gi++) {
      var members = groups[gi], seed = members[0];
      if (members.length === 1) { seed.marker.getElement().style.display = ''; continue; }
      var lng = 0, lat = 0, spread = 0;
      members.forEach(function (m) { lng += m.lnglat[0]; lat += m.lnglat[1]; });
      var centre = [lng / members.length, lat / members.length];
      members.forEach(function (m) {   // metres from the centre (rough, fine at this scale)
        var ddx = (m.lnglat[0] - centre[0]) * 69600, ddy = (m.lnglat[1] - centre[1]) * 111200;
        spread = Math.max(spread, Math.sqrt(ddx * ddx + ddy * ddy));
      });
      // places sharing (almost) one spot fan out once zoomed in a little
      if (zoom >= FAN_ZOOM || (spread < 15 && zoom >= 12.5)) fanOut(members, centre);
      else bubble(members, centre);
    }
    var open = openPopup && openPopup.isOpen() ? openPopup : null;
    if (open) for (var k = 0; k < items.length; k++) if (items[k].clustered && items[k].marker.getPopup() === open) open.remove();
  }

  // ---------- legend ----------
  function buildLegend() {
    var list = document.getElementById('legend-list');
    list.innerHTML = '';
    LAYERS.forEach(function (layer) {
      var st = state[layer.id];
      var li = document.createElement('li');
      li.className = 'lg-row' + (layer.comingSoon ? ' soon' : '');
      var count = layer.comingSoon ? '<span class="lg-soon">coming soon</span>' : '<span class="lg-count">' + st.markers.length + '</span>';
      li.innerHTML =
        '<label><input type="checkbox" ' + (layer.comingSoon ? 'disabled' : 'checked') + ' data-layer="' + layer.id + '">' +
        '<span class="lg-icon" style="--c:' + layer.colour + '">' + svgIcon(layer.icon, 14) + '</span>' +
        '<span class="lg-name">' + esc(layer.name) + '</span>' + count + '</label>';
      list.appendChild(li);
      if (layer.categories && !layer.comingSoon) {
        var sub = document.createElement('ul');
        sub.className = 'lg-sub';
        Object.keys(layer.categories).forEach(function (cat) {
          var n = st.markers.filter(function (m) { return m.category === cat; }).length;
          if (!n) return;
          var s = document.createElement('li');
          var catOn = !st.hiddenCats[cat];
          s.innerHTML = '<label><input type="checkbox" ' + (catOn ? 'checked ' : '') + 'data-layer="' + layer.id + '" data-cat="' + esc(cat) + '">' +
            '<span class="lg-dot' + (layer.categoryPinClass && layer.categoryPinClass[cat] === 'pin-sm' ? ' lg-dot-sm' : (layer.categoryPinClass ? ' lg-dot-lg' : '')) + '" style="background:' + layer.categories[cat] + '"></span>' +
            '<span class="lg-name">' + esc(catLabel(layer, cat)) + '</span><span class="lg-count">' + n + '</span></label>';
          sub.appendChild(s);
        });
        li.appendChild(sub);
      }
    });
    list.addEventListener('change', function (e) {
      var t = e.target, id = t.getAttribute('data-layer'), cat = t.getAttribute('data-cat');
      if (!id) return;
      if (cat) state[id].hiddenCats[cat] = !t.checked;
      else {
        state[id].visible = t.checked;
        var subs = list.querySelectorAll('input[data-layer="' + id + '"][data-cat]');
        subs.forEach(function (s) { s.disabled = !t.checked; });
      }
      refreshVisibility(id);
      if (id === 'businesses') syncExploreButtons();
      updateLegendTotal();
    });
    updateLegendTotal();
    syncExploreButtons();
  }

  function businessCounts() {
    var st = state.businesses;
    if (!st) return { total: 0, shown: 0 };
    var shown = st.markers.filter(function (m) { return isShown(st, m); }).length;
    return { total: st.markers.length, shown: shown };
  }

  function updateLegendTotal() {
    var b = businessCounts();
    var extras = 0;
    ['parking', 'toilets'].forEach(function (id) {
      if (state[id] && state[id].visible) extras += state[id].markers.length;
    });
    var el = document.getElementById('legend-total');
    if (!el) return;
    if (b.shown === b.total) el.textContent = b.total + ' businesses' + (extras ? ' + ' + extras + ' amenities' : '');
    else el.textContent = b.shown + ' of ' + b.total + ' businesses' + (extras ? ' + ' + extras + ' amenities' : '');
  }

  function isExploreMode() {
    var hidden = window.EXPLORE_HIDDEN || ['Professional', 'Services'];
    var st = state.businesses;
    if (!st) return true;
    return hidden.every(function (c) { return !!st.hiddenCats[c]; });
  }

  function setExploreMode(on) {
    var hidden = window.EXPLORE_HIDDEN || ['Professional', 'Services'];
    var st = state.businesses;
    if (!st) return;
    hidden.forEach(function (c) { st.hiddenCats[c] = on; });
    var list = document.getElementById('legend-list');
    hidden.forEach(function (c) {
      var input = list.querySelector('input[data-layer="businesses"][data-cat="' + c + '"]');
      if (input) input.checked = !on;
    });
    refreshVisibility('businesses');
    syncExploreButtons();
    updateLegendTotal();
  }

  function syncExploreButtons() {
    var on = isExploreMode();
    var explore = document.getElementById('explore-btn');
    var all = document.getElementById('show-all-btn');
    var note = document.getElementById('explore-note');
    if (explore) { explore.classList.toggle('on', on); explore.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (all) { all.classList.toggle('on', !on); all.setAttribute('aria-pressed', !on ? 'true' : 'false'); }
    if (note) note.style.display = on ? '' : 'none';
  }

  // ---------- basemap toggle (map / satellite) ----------
  function addSatellite() {
    var sat = window.BASEMAPS.satellite;
    if (map.getSource('sat')) return;
    map.addSource('sat', { type: 'raster', tiles: sat.tiles, tileSize: 256, maxzoom: 19, attribution: sat.attribution });
    map.addLayer({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } });
  }
  function setBasemap(kind) {
    if (!map.getLayer('sat')) return;
    map.setLayoutProperty('sat', 'visibility', kind === 'satellite' ? 'visible' : 'none');
    document.querySelectorAll('.bm-btn').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-bm') === kind);
    });
    document.body.classList.toggle('is-sat', kind === 'satellite');
  }
  document.querySelectorAll('.bm-btn').forEach(function (b) {
    b.addEventListener('click', function () { setBasemap(b.getAttribute('data-bm')); });
  });

  // ---------- mobile legend toggle ----------
  var legend = document.getElementById('legend');
  function setLegend(open) {
    legend.classList.toggle('open', open);
    document.body.classList.toggle('legend-open', open);
  }
  document.getElementById('legend-open').addEventListener('click', function () { setLegend(true); });
  document.getElementById('legend-close').addEventListener('click', function () { setLegend(false); });
  if (window.matchMedia('(min-width: 760px)').matches) setLegend(true);
  var exploreBtn = document.getElementById('explore-btn');
  var showAllBtn = document.getElementById('show-all-btn');
  if (exploreBtn) exploreBtn.addEventListener('click', function () { setExploreMode(true); });
  if (showAllBtn) showAllBtn.addEventListener('click', function () { setExploreMode(false); });

  // ---------- load data ----------
  function loadCsv(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    }).then(function (txt) {
      return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
    });
  }

  LAYERS.forEach(function (l) {
    var hidden = {};
    (l.defaultHiddenCategories || []).forEach(function (c) { hidden[c] = true; });
    state[l.id] = { visible: !l.comingSoon, markers: [], hiddenCats: hidden };
  });

  function tintBasemap() {
    // Warm the Positron greys toward Hello Dorking cream, sage and forest.
    var sets = [
      ['background', 'background-color', '#f3eee6'],
      ['park', 'fill-color', '#d5dcc8'],
      ['landcover_wood', 'fill-color', '#cfd8c6'],
      ['landuse_residential', 'fill-color', '#eee8df'],
      ['building', 'fill-color', '#e6dfd4'],
      ['building', 'fill-outline-color', '#d4cbbd'],
      ['water', 'fill-color', '#c5d0c8'],
      ['waterway', 'line-color', '#b7c4bc']
    ];
    sets.forEach(function (item) {
      if (!map.getLayer(item[0])) return;
      try { map.setPaintProperty(item[0], item[1], item[2]); } catch (e) {}
    });
  }

  map.on('load', function () {
    tintBasemap();
    addSatellite();
    var jobs = LAYERS.filter(function (l) { return !l.comingSoon; }).map(function (layer) {
      return loadCsv(layer.file).then(function (rows) { addMarkers(layer, rows); })
        .catch(function (err) { console.warn('Layer failed:', layer.name, err); });
    });
    Promise.all(jobs).then(function () {
      buildLegend();
      var start = window.MAP_START || {};
      var wide = window.innerWidth >= 760, core = start.phoneBounds;
      if (!wide && core) {
        map.fitBounds(core, { padding: { top: 70, bottom: 90, left: 10, right: 10 }, duration: 0, maxZoom: 17.2 });
      } else if (start.center) {
        map.jumpTo({ center: start.center, zoom: start.zoom || 16.7 });
      }
      recluster();
      map.on('zoomend', recluster);
      document.body.classList.add('ready');
      // Expose for testing / deep links
      window.__dorking = { map: map, state: state, setBasemap: setBasemap, setLegend: setLegend, openPlace: openPlace, findPlace: findPlace, slugify: slugify, businessFromUrl: businessFromUrl, recluster: recluster, tellUsHref: tellUsHref, setTellUsLink: setTellUsLink, setExploreMode: setExploreMode };
      initSearch();
      var q = businessFromUrl();
      if (q) openPlace(q);
      window.addEventListener('hashchange', function () {
        var next = businessFromUrl();
        if (next) openPlace(next);
      });
    });
  });

  function revealMarker(m) {
    var st = state[m.layerId];
    if (!st) return;
    if (m.category && st.hiddenCats[m.category]) {
      st.hiddenCats[m.category] = false;
      var input = document.querySelector('#legend-list input[data-layer="' + m.layerId + '"][data-cat="' + m.category + '"]');
      if (input) input.checked = true;
      refreshVisibility(m.layerId);
      syncExploreButtons();
      updateLegendTotal();
    }
    if (!st.visible) {
      st.visible = true;
      var layerBox = document.querySelector('#legend-list input[data-layer="' + m.layerId + '"]:not([data-cat])');
      if (layerBox) layerBox.checked = true;
      refreshVisibility(m.layerId);
    }
  }

  function findPlace(query) {
    var raw = String(query || '').trim();
    if (!raw) return null;
    var needle = raw.toLowerCase();
    var slugNeedle = slugify(raw);
    var exactSlug = null, exactName = null, partial = null;
    for (var id in state) {
      for (var i = 0; i < state[id].markers.length; i++) {
        var m = state[id].markers[i];
        var nm = String(m.name || m.marker._dkName || '');
        var sl = m.slug || slugify(nm);
        if (slugNeedle && sl === slugNeedle) { exactSlug = m; break; }
        if (nm.toLowerCase() === needle) exactName = m;
        if (!partial && nm.toLowerCase().indexOf(needle) !== -1) partial = m;
      }
      if (exactSlug) break;
    }
    return exactSlug || exactName || partial;
  }

  function openPlace(name) {
    var m = findPlace(name);
    if (!m) return false;
    revealMarker(m);
    if (openPopup && openPopup.isOpen()) openPopup.remove();
    map.jumpTo({ center: m.lnglat, zoom: Math.max(map.getZoom(), FAN_ZOOM + 0.2) });
    if (m.clustered) map.jumpTo({ center: m.lnglat, zoom: FAN_ZOOM + 0.2 });
    setTimeout(function () {
      if (m.clustered) recluster();
      if (!m.marker.getPopup().isOpen()) m.marker.togglePopup();
    }, 180);
    return true;
  }

  function initSearch() {
    var input = document.getElementById('place-search');
    var list = document.getElementById('search-results');
    if (!input || !list) return;
    var active = -1, items = [];

    function closeList() { list.hidden = true; list.innerHTML = ''; active = -1; items = []; }

    function allMarkers() {
      var out = [];
      Object.keys(state).forEach(function (id) {
        state[id].markers.forEach(function (m) { out.push(m); });
      });
      return out;
    }

    function render(q) {
      var needle = q.trim().toLowerCase();
      list.innerHTML = '';
      active = -1;
      if (needle.length < 2) { closeList(); return; }
      items = allMarkers().filter(function (m) { return (m.search || (m.name || '').toLowerCase()).indexOf(needle) !== -1; }).slice(0, 12);
      if (!items.length) {
        list.innerHTML = '<li class="sr-empty">No matching places</li>';
        list.hidden = false;
        return;
      }
      items.forEach(function (m, i) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = esc(m.name) + '<span class="sr-cat">' + esc(m.category || '') + '</span>';
        btn.addEventListener('click', function () {
          input.value = m.name;
          closeList();
          openPlace(m.name);
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
      list.hidden = false;
    }

    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      var btns = list.querySelectorAll('button');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = Math.min(btns.length - 1, active + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, active - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active >= 0 && btns[active]) btns[active].click();
        else if (btns[0]) btns[0].click();
        return;
      } else if (e.key === 'Escape') {
        closeList();
        return;
      } else return;
      btns.forEach(function (b, i) { b.classList.toggle('active', i === active); });
      if (btns[active]) btns[active].scrollIntoView({ block: 'nearest' });
    });
    document.addEventListener('click', function (e) {
      if (!list.contains(e.target) && e.target !== input) closeList();
    });
  }
})();
