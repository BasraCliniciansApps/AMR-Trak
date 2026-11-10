// Desktop-only layout tweaks. Moves existing nodes (functions/handlers untouched).
document.addEventListener('DOMContentLoaded', function () {
  var header = document.querySelector('#mainAppContainer header');
  if (!header) return;
  // 1) brand (logo + name) at the start of the header, same look as the dashboard
  var brand = document.createElement('div');
  brand.id = 'dtBrand';
  brand.innerHTML = '<img src="img/logo.png" alt="AMR Trak"><span class="dt-name">AMR <span>Trak</span></span>';
  var left = header.firstElementChild;           // title block container
  left.insertBefore(brand, left.firstChild);
  // 2) move the existing Export Antibiogram button into the header, next to Add Isolate
  var exp = document.querySelector('#mainAppContainer aside button[onclick*="showExportModal"]');
  var right = header.lastElementChild;
  var addBtn = right.querySelector('button[onclick*="openModal"]');
  if (exp && addBtn) {
    var slot = document.createElement('div'); slot.id = 'dtExportSlot';
    slot.appendChild(exp);
    right.insertBefore(slot, addBtn.nextSibling);
  }
  // 3) Dashboard (phone view) button
  if (window.desktopApp && addBtn) {
    var b = document.createElement('button');
    b.id = 'dtDashBtn'; b.type = 'button'; b.title = 'Open the live dashboard in a phone-sized window';
    b.innerHTML = '<svg class="w-4 h-4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>Dashboard';
    b.onclick = function () { window.desktopApp.openDashboard(); };
    right.insertBefore(b, addBtn);
  }
});
