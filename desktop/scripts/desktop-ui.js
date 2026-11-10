// Desktop-only layout. Only moves/adds DOM and calls the app's existing global functions.
(function () {
  var NAMES_VISIBLE = false;
  var ICONS = {
    add: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>',
    db: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    exp: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    ctl: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    cog: '<path stroke-linecap="round" stroke-linejoin="round" d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.6c1.8.4 1.8 2.9 0 3.4a1.7 1.7 0 00-1.1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-2.9 1.8-3.4 0a1.7 1.7 0 00-2.6-1.1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-2.9 0-3.4a1.7 1.7 0 001.1-2.6c-.9-1.5.8-3.3 2.4-2.4.9.5 2.1.1 2.6-1z"/><circle cx="12" cy="12" r="3"/>',
    info: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
  };
  function svg(k) { return '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + ICONS[k] + '</svg>'; }

  function setMode(m) {
    document.body.classList.toggle('dt-home', m === 'home');
    document.body.classList.toggle('dt-records', m === 'records');
    if (m === 'records') {
      setTimeout(function () {                      // table was hidden while (re)built: fix column widths
        try { if (window.jQuery && $.fn.dataTable) $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust(); } catch (e) {}
        applyMask();
      }, 60);
    } else { NAMES_VISIBLE = false; updateNamesBtn(); }
  }
  window.dtShowRecords = function () { setMode('records'); };
  window.dtShowHome = function () { setMode('home'); };

  /* ---- patient-name masking (display only; data untouched) ---- */
  function nameColIndex() {
    var idx = -1;
    document.querySelectorAll('#recordsTable thead th').forEach(function (th, i) {
      if (idx < 0 && /patient name/i.test(th.textContent)) idx = i;
    });
    return idx;
  }
  function applyMask() {
    var idx = nameColIndex(); if (idx < 0) return;
    document.querySelectorAll('#recordsTable tbody tr').forEach(function (tr) {
      var td = tr.children[idx]; if (!td || td.classList.contains('dataTables_empty')) return;
      if (!td.classList.contains('dt-name-cell')) {
        td.classList.add('dt-name-cell'); td.dataset.real = td.textContent;
        td.title = 'Click to show / hide';
        td.addEventListener('click', function () { td.dataset.show = td.dataset.show === '1' ? '0' : '1'; paint(td); });
      } else if (td.dataset.real !== undefined && !td.classList.contains('dt-masked') && td.textContent !== td.dataset.real && td.textContent.indexOf('•') < 0) {
        td.dataset.real = td.textContent;           // cell was redrawn with new text
      }
      paint(td);
    });
  }
  function paint(td) {
    var show = NAMES_VISIBLE || td.dataset.show === '1';
    td.classList.toggle('dt-masked', !show);
    td.textContent = show ? td.dataset.real : '••••••••';
  }
  function updateNamesBtn() {
    var b = document.getElementById('dtNamesBtn'); if (!b) return;
    b.innerHTML = (NAMES_VISIBLE ? 'Hide names' : 'Reveal names');
    document.querySelectorAll('#recordsTable td.dt-name-cell').forEach(function (td) { delete td.dataset.show; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var header = document.querySelector('#mainAppContainer header');
    var main = document.getElementById('mainScrollArea');
    if (!header || !main) return;
    var left = header.firstElementChild, right = header.lastElementChild;

    // brand + back button + title block
    var titleBlock = left.firstElementChild; titleBlock.id = 'dtTitleBlock';
    var brand = document.createElement('div'); brand.id = 'dtBrand';
    brand.innerHTML = '<img src="img/logo.png" alt="AMR Trak"><span class="dt-name">AMR <span>Trak</span></span>';
    left.insertBefore(brand, left.firstChild);
    var back = document.createElement('button'); back.id = 'dtBack'; back.type = 'button';
    back.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>Home';
    back.onclick = window.dtShowHome; left.insertBefore(back, left.firstChild);

    // reveal-names toggle (records mode)
    var nb = document.createElement('button'); nb.id = 'dtNamesBtn'; nb.type = 'button'; nb.textContent = 'Reveal names';
    nb.onclick = function () { NAMES_VISIBLE = !NAMES_VISIBLE; updateNamesBtn(); applyMask(); };
    right.insertBefore(nb, right.firstChild);

    // home screen
    var cards = [
      ['add', 'Add Isolate', 'Enter a new patient isolate record.', 'openModal()', true],
      ['db', 'Isolate Database', 'Browse, search, edit and manage records.', 'dtShowRecords()'],
      ['exp', 'Export Antibiogram', 'Generate the ministry antibiogram file.', 'showExportModal()'],
      ['phone', 'Dashboard', 'Open the live dashboard in a phone-sized window.', 'desktopApp.openDashboard()'],
      ['ctl', 'Dashboard Control', 'Manage what the dashboard shows.', 'showDashControl()'],
      ['cog', 'Settings', 'System settings, backup and restore.', 'showSettingsModal()']
    ];
    var home = document.createElement('div'); home.id = 'dtHome';
    home.innerHTML = '<h1>AMR Trak</h1><p class="dt-sub">Clinical Microbiology Information System</p><div id="dtGrid"></div>';
    var grid = home.querySelector('#dtGrid');
    cards.forEach(function (c) {
      if (c[3].indexOf('desktopApp') === 0 && !window.desktopApp) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dt-card' + (c[4] ? ' primary' : '');
      b.innerHTML = '<div class="ic">' + svg(c[0]) + '</div><div class="t">' + c[1] + '</div><div class="d">' + c[2] + '</div>';
      b.setAttribute('onclick', c[3]); grid.appendChild(b);
    });
    main.insertBefore(home, main.firstChild);

    // keep names masked when the table redraws (search / sort / page / edit)
    if (window.jQuery) $(document).on('draw.dt init.dt', '#recordsTable', function () { setTimeout(applyMask, 0); });
    setMode('home');
  });
})();
