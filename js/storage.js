// localStorage แบบปลอดภัย (โหมดไม่ระบุตัวตน/ปิดคุกกี้ ก็ยังใช้เว็บได้ แค่ไม่จำค่า)
(function () {
  'use strict';
  var P = 'iduinoR4.';
  var HISTORY_MAX = 50;

  function get(key, def) {
    try {
      var v = localStorage.getItem(P + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }
  function set(key, val) {
    try { localStorage.setItem(P + key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }
  function del(key) {
    try { localStorage.removeItem(P + key); } catch (e) { /* ignore */ }
  }
  function history() {
    var h = get('history', []);
    return Array.isArray(h) ? h.filter(function (r) { return r && typeof r.total === 'number' && typeof r.correct === 'number'; }) : [];
  }
  function addHistory(entry) {
    var h = history();
    h.unshift(entry);
    set('history', h.slice(0, HISTORY_MAX));
  }

  window.Store = { get: get, set: set, del: del, history: history, addHistory: addHistory };
})();
