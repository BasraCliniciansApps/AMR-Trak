// Replaces window.localStorage with a file-backed store (Documents/AMR Trak/amr-data.json)
// so the existing web code works unchanged.
(function () {
  if (!window.desktopStore) return;
  var data = window.desktopStore.load() || {};
  var store = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { v = String(v); data[k] = v; window.desktopStore.set(k, v); },
    removeItem: function (k) { delete data[k]; window.desktopStore.remove(k); },
    clear: function () { data = {}; window.desktopStore.clear(); },
    key: function (i) { return Object.keys(data)[i] || null; }
  };
  Object.defineProperty(store, 'length', { get: function () { return Object.keys(data).length; } });
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
})();
