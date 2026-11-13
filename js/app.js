// UI: หน้าแรก / ทำข้อสอบ / ผลสอบ / เฉลย
(function () {
  'use strict';
  var E = window.ExamCore, S = window.Store, hl = window.highlightCpp;
  var bank = E.buildBank(window.EXAM_DATA);
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');
  var LETTERS = ['ก', 'ข', 'ค', 'ง'];
  var TIMES = [0, 30, 60, 90];
  var QUICK_N = [20, 40, 60, 100];
  var WEAK_PCT = 70;

  var view = 'home';
  var exam = null;     // ข้อสอบที่กำลังทำ
  var done = null;     // ข้อสอบที่ส่งแล้ว (ใช้ดูผล/เฉลย)
  var ui = { paletteOpen: false, filter: 'all' };
  var prefs = loadPrefs();
  var timerId = null;

  // อ่านค่าจาก localStorage แบบตรวจรูปแบบ ข้อมูลเสีย/เวอร์ชันเก่าจะไม่ทำให้เว็บพัง
  function loadPrefs() {
    var p = S.get('prefs', null) || {};
    var nCh = bank.chapters.length;
    return {
      mode: p.mode === 'random' ? 'random' : 'chapters',
      chapters: Array.isArray(p.chapters) ? p.chapters.filter(function (c) { return Number.isInteger(c) && c >= 0 && c < nCh; }) : [],
      n: Number.isInteger(p.n) && p.n >= 1 && p.n <= bank.items.length ? p.n : 40,
      minutes: TIMES.indexOf(p.minutes) >= 0 ? p.minutes : 0
    };
  }
  function validExam(x) {
    return !!(x && Array.isArray(x.items) && x.items.length && x.answers && x.flags &&
      x.items.every(function (y) { return y && bank.byId[y.id] && Array.isArray(y.order) && y.order.length === 4; }));
  }
  function loadExam(key) {
    var x = S.get(key, null);
    if (validExam(x)) {
      if (!(x.cur >= 0 && x.cur < x.items.length)) x.cur = 0;
      return x;
    }
    if (x !== null) S.del(key);
    return null;
  }

  var I = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8M5 9.5V21h14V9.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
  };

  // ---------- ตัวช่วย ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function level(p) { return p >= 80 ? 'good' : p >= 50 ? 'mid' : 'bad'; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (h ? String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    return h ? h + ':' + mm : mm;
  }
  function fmtDuration(sec) {
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m ? m + ' นาที ' + s + ' วิ' : s + ' วินาที';
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function codeBlock(code, label) {
    return '<pre class="code-block">' + (label ? '<span class="code-label">' + esc(label) + '</span>' : '') +
      '<code>' + hl(code) + '</code></pre>';
  }
  function themeIsDark() {
    var t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function themeBtn() {
    var dark = themeIsDark();
    return '<button class="icon-btn" data-act="theme" aria-label="' + (dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด') +
      '" title="สลับโหมดมืด/สว่าง">' + (dark ? I.sun : I.moon) + '</button>';
  }
  function savePrefs() { S.set('prefs', prefs); }
  function saveExam() { if (exam) S.set('current', exam); }
  function remainingSec(ex) { return ex.endsAt ? (ex.endsAt - Date.now()) / 1000 : null; }

  // ---------- Modal ----------
  function modal(opts) {
    return new Promise(function (resolve) {
      var html = '<div class="modal-back" data-m="cancel"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">' +
        '<h3 id="m-title">' + esc(opts.title) + '</h3><div class="body">' + (opts.body || '') + '</div><div class="actions">' +
        (opts.cancel === false ? '' : '<button class="btn" data-m="cancel">' + esc(opts.cancel || 'ยกเลิก') + '</button>') +
        '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-m="ok">' + esc(opts.ok || 'ตกลง') + '</button>' +
        '</div></div></div>';
      modalRoot.innerHTML = html;
      var okBtn = modalRoot.querySelector('[data-m="ok"]');
      okBtn.focus();
      function close(v) {
        modalRoot.innerHTML = '';
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      }
      document.addEventListener('keydown', onKey, true);
      modalRoot.firstChild.addEventListener('click', function (e) {
        var t = e.target.closest('[data-m]');
        if (!t) return;
        if (t.classList.contains('modal-back') && e.target !== t) return;
        close(t.dataset.m === 'ok');
      });
    });
  }

  // ---------- หน้าแรก ----------
  function selectedCount() {
    return prefs.chapters.reduce(function (s, c) { return s + (bank.chapters[c] ? bank.chapters[c].count : 0); }, 0);
  }
  function summaryText() {
    var t = prefs.minutes ? 'จับเวลา <b>' + prefs.minutes + ' นาที</b>' : '<b>ไม่จับเวลา</b>';
    if (prefs.mode === 'random') return 'สุ่ม <b>' + prefs.n + ' ข้อ</b> จากทุกบท · ' + t;
    if (!prefs.chapters.length) return 'ยังไม่ได้เลือกบท';
    return 'เลือก <b>' + prefs.chapters.length + ' บท</b> รวม <b>' + selectedCount() + ' ข้อ</b> · ' + t;
  }
  function canStart() { return prefs.mode === 'random' ? prefs.n >= 1 : prefs.chapters.length > 0; }

  function renderHome() {
    var saved = loadExam('current');
    var history = S.history();
    var h = '';
    h += '<header class="topbar"><div class="wrap"><div class="brand"><span class="brand-mark">R4</span>ข้อสอบ i-Duino R4</div>' +
      '<span class="spacer"></span>' + themeBtn() + '</div></header>';
    h += '<main class="wrap"><section class="hero"><h1>ฝึกทำข้อสอบ i-Duino R4 กับ Arduino IDE</h1>' +
      '<p>' + bank.items.length + ' ข้อ ' + bank.chapters.length + ' บท พร้อมเฉลยและคำอธิบายทุกข้อ</p></section>';
    h += '<div class="home-grid"><div>';

    if (saved) {
      var answered = Object.keys(saved.answers).length;
      var rem = remainingSec(saved);
      h += '<section class="card resume"><div class="card-head"><h2>มีข้อสอบที่ทำค้างไว้</h2></div>' +
        '<div>' + esc(saved.label) + ' · ตอบแล้ว ' + answered + '/' + saved.items.length + ' ข้อ' +
        (rem !== null ? ' · ' + (rem > 0 ? 'เหลือเวลา ' + fmtTime(rem) : 'หมดเวลาแล้ว') : '') + '</div>' +
        '<div class="row"><button class="btn primary" data-act="resume">' + (rem !== null && rem <= 0 ? 'ส่งคำตอบและดูผล' : 'ทำต่อ') + '</button>' +
        '<button class="btn danger" data-act="discard">ทิ้งข้อสอบนี้</button></div></section>';
    }

    h += '<section class="card"><div class="card-head"><h2>เริ่มสอบ</h2></div>';
    h += '<div class="seg" role="group" aria-label="รูปแบบข้อสอบ">' +
      '<button data-act="mode" data-v="chapters" aria-pressed="' + (prefs.mode === 'chapters') + '">เลือกบท</button>' +
      '<button data-act="mode" data-v="random" aria-pressed="' + (prefs.mode === 'random') + '">สุ่มจากทุกบท</button></div>';

    if (prefs.mode === 'chapters') {
      h += '<div class="section-label" style="margin-top:18px">บทที่ต้องการสอบ <span class="muted small">(เลือกได้หลายบท)</span></div>';
      h += '<div class="chapter-tools"><button class="btn sm" data-act="ch-all">เลือกทั้งหมด</button>' +
        '<button class="btn sm ghost" data-act="ch-none">ล้าง</button></div><div class="chapter-list">';
      bank.chapters.forEach(function (c) {
        var on = prefs.chapters.indexOf(c.i) >= 0;
        h += '<label class="ch-item' + (on ? ' on' : '') + '"><input type="checkbox" data-ch="' + c.i + '"' + (on ? ' checked' : '') + '>' +
          '<span class="ch-text"><span class="ch-num">บทที่ ' + (c.i + 1) + '</span> ' + esc(c.short) +
          '<div class="ch-count">' + c.count + ' ข้อ</div></span></label>';
      });
      h += '</div>';
    } else {
      h += '<div class="section-label" style="margin-top:18px">จำนวนข้อ</div><div class="num-row">' +
        '<input class="num-input" type="number" inputmode="numeric" min="1" max="' + bank.items.length + '" value="' + prefs.n + '" id="n-input" aria-label="จำนวนข้อ">' +
        '<div class="chips">';
      QUICK_N.forEach(function (n) {
        h += '<button class="chip" data-act="n" data-v="' + n + '" aria-pressed="' + (prefs.n === n) + '">' + n + '</button>';
      });
      h += '</div></div><p class="muted small" style="margin:8px 0 0">ข้อที่ต่อเนื่องกัน (เช่น "จากโค้ดข้อที่แล้ว") จะถูกเลือกมาคู่กันเสมอ</p>';
    }

    h += '<div class="section-label">เวลา</div><div class="chips">';
    TIMES.forEach(function (m) {
      h += '<button class="chip" data-act="time" data-v="' + m + '" aria-pressed="' + (prefs.minutes === m) + '">' +
        (m ? m + ' นาที' : 'ไม่จับเวลา') + '</button>';
    });
    h += '</div><div class="start-summary" id="summary">' + summaryText() + '</div>' +
      '<button class="btn primary block lg" data-act="start" id="start-btn"' + (canStart() ? '' : ' disabled') + '>เริ่มทำข้อสอบ</button>';
    h += '</section></div><div>';

    // บทที่ควรทบทวน
    var stats = E.chapterStats(history, bank.chapters.length);
    var weak = stats.filter(function (s) { return s.pct !== null && s.pct < WEAK_PCT; })
      .sort(function (a, b) { return a.pct - b.pct; });
    var untested = stats.filter(function (s) { return s.attempts === 0; }).length;
    h += '<section class="card"><div class="card-head"><h2>บทที่ควรทบทวน</h2></div>';
    if (!history.length) {
      h += '<p class="empty">ยังไม่มีประวัติ ลองทำข้อสอบสักชุดแล้วระบบจะแนะนำบทที่ควรทบทวน</p>';
    } else {
      if (!weak.length) h += '<p class="empty">ทุกบทที่เคยสอบได้คะแนน ' + WEAK_PCT + '% ขึ้นไป เยี่ยมมาก!</p>';
      else {
        h += '<div class="weak-list">';
        weak.slice(0, 6).forEach(function (s) {
          var lv = level(s.pct);
          h += '<div class="weak-item"><div class="name"><b>บทที่ ' + (s.ch + 1) + '</b> ' + esc(bank.chapters[s.ch].short) +
            '<div class="muted small"><span class="txt-' + lv + '"><b>' + s.pct + '%</b></span> · สอบ ' + s.attempts + ' ครั้ง</div></div>' +
            '<button class="btn sm" data-act="practice" data-v="' + s.ch + '">ฝึกบทนี้</button>' +
            '<div class="meter"><i class="lv-' + lv + '" style="width:' + s.pct + '%"></i></div></div>';
        });
        h += '</div>';
      }
      if (untested) h += '<p class="muted small" style="margin:12px 0 0">ยังไม่เคยสอบอีก ' + untested + ' บท</p>';
    }
    h += '</section>';

    // ประวัติ
    h += '<section class="card"><div class="card-head"><h2>ประวัติการสอบ</h2><span class="spacer"></span>' +
      (history.length ? '<button class="btn sm ghost danger" data-act="clear-history">ล้างประวัติ</button>' : '') + '</div>';
    if (!history.length) h += '<p class="empty">ยังไม่มีประวัติการสอบ</p>';
    else {
      h += '<table class="hist"><thead><tr><th>วันที่</th><th>ชุดข้อสอบ</th><th>คะแนน</th></tr></thead><tbody>';
      history.slice(0, 10).forEach(function (r) {
        var p = r.total ? Math.round((r.correct / r.total) * 100) : 0;
        h += '<tr><td class="muted" style="white-space:nowrap">' + fmtDate(r.at) + '</td><td>' + esc(r.label) + '</td>' +
          '<td class="score"><b class="txt-' + level(p) + '">' + p + '%</b><div class="muted small">' + r.correct + '/' + r.total + '</div></td></tr>';
      });
      h += '</tbody></table>';
      if (history.length > 10) h += '<p class="muted small" style="margin:8px 0 0">แสดง 10 ครั้งล่าสุดจากทั้งหมด ' + history.length + ' ครั้ง</p>';
    }
    h += '</section></div></div></main>';
    h += '<footer class="footer">อ้างอิงจากคู่มือ "แนะนำการใช้งาน i-Duino R4 ด้วยซอฟต์แวร์ Arduino IDE" · ประวัติเก็บไว้ในเบราว์เซอร์นี้เท่านั้น</footer>';
    app.innerHTML = h;
  }

  function updateHomeSummary() {
    var s = document.getElementById('summary'), b = document.getElementById('start-btn');
    if (s) s.innerHTML = summaryText();
    if (b) b.disabled = !canStart();
  }

  // ---------- เริ่ม/ส่งข้อสอบ ----------
  function startExam(ids, mode) {
    if (!ids.length) return;
    var meta = { mode: mode, minutes: prefs.minutes };
    var chs = {};
    ids.forEach(function (id) { chs[bank.byId[id].ch] = true; });
    meta.label = E.makeLabel(bank, mode, Object.keys(chs).map(Number).sort(function (a, b) { return a - b; }), ids.length);
    exam = E.createExam(bank, ids, meta);
    saveExam();
    ui.paletteOpen = false;
    go('exam');
  }

  function startFromPrefs() {
    if (prefs.mode === 'random') startExam(E.pickRandom(bank, prefs.n), 'random');
    else startExam(E.idsOfChapters(bank, prefs.chapters.slice().sort(function (a, b) { return a - b; })), 'chapters');
  }

  function submitExam() {
    stopTimer();
    var g = E.grade(bank, exam);
    var used = Math.min(Date.now(), exam.endsAt || Infinity) - exam.startedAt;
    exam.finishedAt = Date.now();
    exam.usedSec = Math.round(used / 1000);
    S.addHistory({ at: exam.finishedAt, label: exam.label, mode: exam.mode, chapters: exam.chapters,
      correct: g.correct, total: g.total, per: g.per, secs: exam.usedSec });
    done = exam;
    S.set('last', done);
    S.del('current');
    exam = null;
    ui.filter = 'all';
    go('result');
  }

  function confirmSubmit() {
    var answered = Object.keys(exam.answers).length;
    var left = exam.items.length - answered;
    var flagged = Object.keys(exam.flags).length;
    var body = '';
    if (left || flagged) {
      body = '<ul>' + (left ? '<li>ยังไม่ได้ตอบ <b>' + left + '</b> ข้อ</li>' : '') +
        (flagged ? '<li>ปักธงไว้ <b>' + flagged + '</b> ข้อ</li>' : '') + '</ul>';
    } else body = 'ตอบครบทุกข้อแล้ว';
    modal({ title: 'ส่งคำตอบ?', body: body, ok: 'ส่งคำตอบ', cancel: 'กลับไปทำต่อ' }).then(function (ok) {
      if (ok) submitExam();
    });
  }

  // ---------- ตัวจับเวลา ----------
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function startTimer() {
    stopTimer();
    if (!exam || !exam.endsAt) return;
    tick();
    timerId = setInterval(tick, 1000);
  }
  function tick() {
    if (!exam) return stopTimer();
    var rem = remainingSec(exam);
    var el = document.getElementById('timer');
    if (el) {
      el.querySelector('span').textContent = fmtTime(rem);
      el.classList.toggle('low', rem <= 300);
    }
    if (rem <= 0) {
      stopTimer();
      modalRoot.innerHTML = '';
      submitExam();
      modal({ title: 'หมดเวลา', body: 'ระบบส่งคำตอบให้อัตโนมัติแล้ว', ok: 'ดูผลสอบ', cancel: false });
    }
  }

  // ---------- หน้าทำข้อสอบ ----------
  function renderExam() {
    var x = exam.items[exam.cur], it = bank.byId[x.id];
    var n = exam.items.length;
    var answeredCount = Object.keys(exam.answers).length;
    var flagged = !!exam.flags[x.id];
    var picked = exam.answers[x.id];
    var rem = remainingSec(exam);
    var h = '';

    h += '<header class="topbar exam-top"><div class="wrap">' +
      '<button class="icon-btn" data-act="exit" aria-label="กลับหน้าแรก" title="กลับหน้าแรก (ข้อสอบจะถูกบันทึกไว้)">' + I.home + '</button>' +
      '<div class="exam-progress">ข้อ ' + (exam.cur + 1) + '<small>/' + n + '</small></div><span class="spacer"></span>' +
      (rem !== null ? '<div class="timer' + (rem <= 300 ? ' low' : '') + '" id="timer" role="timer" aria-label="เวลาที่เหลือ">' + I.clock + '<span>' + fmtTime(rem) + '</span></div>' : '') +
      '<button class="btn primary sm" data-act="submit">ส่งคำตอบ</button></div>' +
      '<div class="progress-line"><i style="width:' + (answeredCount / n * 100) + '%"></i></div></header>';

    h += '<main class="wrap"><div class="exam-layout"><section><article class="card">';
    h += '<div class="q-meta"><span class="q-num">ข้อ ' + (exam.cur + 1) + '</span>' +
      '<span class="tag">บทที่ ' + (it.ch + 1) + ' · ข้อ ' + (it.idx + 1) + '</span></div>';
    h += questionBody(it);
    h += '<div class="choices" role="radiogroup" aria-label="ตัวเลือก">';
    x.order.forEach(function (orig, pos) {
      var on = picked === orig;
      h += '<button class="choice" role="radio" aria-checked="' + on + '" data-act="pick" data-v="' + orig + '">' +
        '<span class="letter">' + LETTERS[pos] + '</span><span class="ctext">' + esc(it.choices[orig]) + '</span></button>';
    });
    h += '</div>';
    h += '<div class="q-actions"><button class="btn sm flag-btn" data-act="flag" aria-pressed="' + flagged + '">' + I.flag +
      (flagged ? 'ปักธงแล้ว' : 'ปักธง (ไม่แน่ใจ)') + '</button>' +
      (picked !== undefined ? '<button class="btn sm ghost" data-act="clear">ล้างคำตอบ</button>' : '') + '</div>';
    h += '</article>';
    h += '<div class="nav-desktop"><button class="btn" data-act="prev"' + (exam.cur === 0 ? ' disabled' : '') + '>' + I.left + 'ก่อนหน้า</button>' +
      (exam.cur === n - 1 ? '<button class="btn primary" data-act="submit">ส่งคำตอบ</button>'
        : '<button class="btn primary" data-act="next">ถัดไป' + I.right + '</button>') + '</div>';
    h += '<p class="kbd-hint">คีย์ลัด: <kbd>1</kbd>–<kbd>4</kbd> เลือกตัวเลือก · <kbd>←</kbd> <kbd>→</kbd> เปลี่ยนข้อ · <kbd>F</kbd> ปักธง</p>';
    h += '</section>';

    // แผงเลขข้อ
    if (ui.paletteOpen) h += '<div class="scrim" data-act="pal-close"></div>';
    h += '<aside class="card palette' + (ui.paletteOpen ? ' open' : '') + '" aria-label="แผงเลขข้อ">' +
      '<div class="card-head"><h2>เลขข้อ</h2><span class="spacer"></span>' +
      '<button class="icon-btn close-pal" data-act="pal-close" aria-label="ปิด">' + I.x + '</button></div>' +
      '<div class="pal-stats">ตอบแล้ว <b>' + answeredCount + '</b>/' + n + ' · ปักธง <b>' + Object.keys(exam.flags).length + '</b></div>' +
      '<div class="palette-grid">';
    var multi = exam.chapters.length > 1, lastCh = -1;
    exam.items.forEach(function (y, i) {
      var ch = bank.byId[y.id].ch;
      if (multi && ch !== lastCh) { h += '<div class="pal-chapter">บทที่ ' + (ch + 1) + '</div>'; lastCh = ch; }
      var cls = 'pal' + (exam.answers[y.id] !== undefined ? ' answered' : '') + (exam.flags[y.id] ? ' flagged' : '') + (i === exam.cur ? ' current' : '');
      h += '<button class="' + cls + '" data-act="goto" data-v="' + i + '" aria-label="ข้อ ' + (i + 1) + '"' +
        (i === exam.cur ? ' aria-current="true"' : '') + '>' + (i + 1) + '</button>';
    });
    h += '</div><div class="legend"><span><i class="a"></i>ตอบแล้ว</span><span><i></i>ยังไม่ตอบ</span><span><i class="f"></i>ปักธง</span></div>' +
      '<button class="btn primary block" data-act="submit">ส่งคำตอบ</button></aside>';
    h += '</div></main>';

    // แถบล่างบนมือถือ
    h += '<nav class="bottom-bar" aria-label="เปลี่ยนข้อ"><button class="btn" data-act="prev"' + (exam.cur === 0 ? ' disabled' : '') + '>' + I.left + 'ก่อนหน้า</button>' +
      '<button class="btn" data-act="pal-open" aria-label="แผงเลขข้อ">' + I.grid + '</button>' +
      (exam.cur === n - 1 ? '<button class="btn primary" data-act="submit">ส่งคำตอบ</button>'
        : '<button class="btn primary" data-act="next">ถัดไป' + I.right + '</button>') + '</nav>';
    app.innerHTML = h;
  }

  function questionBody(it) {
    var h = '';
    if (it.prevCode) h += codeBlock(it.prevCode, 'โค้ดจากข้อที่แล้ว');
    h += '<p class="q-text">' + esc(it.q) + '</p>';
    if (it.code) h += codeBlock(it.code);
    return h;
  }

  function gotoQ(i) {
    if (i < 0 || i >= exam.items.length) return;
    var changed = i !== exam.cur;
    exam.cur = i;
    ui.paletteOpen = false;
    saveExam();
    renderExam();
    if (changed) window.scrollTo(0, 0);
  }

  // ---------- หน้าผลสอบ ----------
  function renderResult() {
    var g = E.grade(bank, done);
    var lv = level(g.pct);
    var msg = g.pct >= 80 ? 'ยอดเยี่ยม!' : g.pct >= 50 ? 'ผ่าน แต่ยังทบทวนเพิ่มได้อีก' : 'ควรทบทวนเนื้อหาเพิ่ม';
    var C = 2 * Math.PI * 70;
    var h = '<header class="topbar"><div class="wrap"><div class="brand"><span class="brand-mark">R4</span>ผลการสอบ</div>' +
      '<span class="spacer"></span>' + themeBtn() + '</div></header><main class="wrap narrow" style="padding-top:18px;padding-bottom:40px">';
    h += '<section class="card result-hero"><div class="score-ring"><svg viewBox="0 0 160 160">' +
      '<circle cx="80" cy="80" r="70" fill="none" stroke="var(--surface-2)" stroke-width="14"/>' +
      '<circle cx="80" cy="80" r="70" fill="none" class="ring-' + lv + '" stroke="var(--' + (lv === 'mid' ? 'mid' : lv) + ')" stroke-width="14" stroke-linecap="round"' +
      ' stroke-dasharray="' + (C * g.pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
      '<div class="val"><div class="pct">' + g.pct + '%</div><div class="frac">' + g.correct + ' / ' + g.total + ' คะแนน</div></div></div>' +
      '<div class="result-msg txt-' + lv + '">' + msg + '</div><div class="muted">' + esc(done.label) + '</div>' +
      '<div class="stats-row"><div class="stat"><b class="txt-good">' + g.correct + '</b><span>ถูก</span></div>' +
      '<div class="stat"><b class="txt-bad">' + (g.total - g.correct - g.unanswered) + '</b><span>ผิด</span></div>' +
      '<div class="stat"><b>' + g.unanswered + '</b><span>ไม่ได้ตอบ</span></div></div>' +
      '<div class="muted small" style="margin-top:10px">ใช้เวลา ' + fmtDuration(done.usedSec) + (done.minutes ? ' จาก ' + done.minutes + ' นาที' : '') + '</div>' +
      '<div class="action-row"><button class="btn primary" data-act="review">' + I.list + 'ดูเฉลย</button>' +
      '<button class="btn" data-act="retry-wrong"' + (g.wrongIds.length ? '' : ' disabled') + '>' + I.redo + 'ทำใหม่ข้อที่ผิด' +
      (g.wrongIds.length ? ' (' + g.wrongIds.length + ')' : '') + '</button>' +
      '<button class="btn" data-act="home">' + I.home + 'หน้าแรก</button></div></section>';

    h += '<section class="card"><div class="card-head"><h2>คะแนนแยกตามบท</h2></div><div class="bars" role="list">';
    Object.keys(g.per).map(Number).sort(function (a, b) { return a - b; }).forEach(function (ch) {
      var p = g.per[ch], pct = Math.round(p[0] / p[1] * 100), l = level(pct);
      h += '<div class="bar-row" role="listitem"><div class="bar-head"><span><b>บทที่ ' + (ch + 1) + '</b> ' + esc(bank.chapters[ch].short) + '</span>' +
        '<span class="v">' + p[0] + '/' + p[1] + ' <span class="txt-' + l + '">(' + pct + '%)</span></span></div>' +
        '<div class="bar-track" aria-hidden="true"><i class="lv-' + l + '" style="width:' + pct + '%"></i></div></div>';
    });
    h += '</div><div class="bar-legend"><span><i class="lv-good"></i>80% ขึ้นไป</span><span><i class="lv-mid"></i>50–79%</span><span><i class="lv-bad"></i>ต่ำกว่า 50%</span></div></section>';
    h += '</main>';
    app.innerHTML = h;
  }

  // ---------- หน้าเฉลย ----------
  function renderReview() {
    var counts = { all: 0, wrong: 0, skip: 0, flag: 0 };
    var rows = done.items.map(function (x, i) {
      var it = bank.byId[x.id], a = done.answers[x.id];
      var st = a === undefined ? 'skip' : a === it.answer ? 'ok' : 'no';
      counts.all++;
      if (st !== 'ok') counts.wrong++;
      if (st === 'skip') counts.skip++;
      if (done.flags[x.id]) counts.flag++;
      return { x: x, i: i, it: it, a: a, st: st };
    });
    var f = ui.filter;
    var shown = rows.filter(function (r) {
      return f === 'all' || (f === 'wrong' && r.st !== 'ok') || (f === 'skip' && r.st === 'skip') || (f === 'flag' && done.flags[r.x.id]);
    });
    var FL = [['all', 'ทั้งหมด'], ['wrong', 'ข้อที่ผิด'], ['skip', 'ไม่ได้ตอบ'], ['flag', 'ปักธง']];

    var h = '<header class="topbar"><div class="wrap"><button class="icon-btn" data-act="result" aria-label="กลับไปหน้าผลสอบ">' + I.left + '</button>' +
      '<div class="brand">เฉลยพร้อมคำอธิบาย</div><span class="spacer"></span>' + themeBtn() + '</div></header>';
    h += '<main class="wrap narrow"><div class="review-filter"><div class="chips" role="group" aria-label="กรองข้อ">';
    FL.forEach(function (o) {
      h += '<button class="chip" data-act="filter" data-v="' + o[0] + '" aria-pressed="' + (f === o[0]) + '">' + o[1] +
        '<span class="count">' + counts[o[0]] + '</span></button>';
    });
    h += '</div></div><div class="review-list">';
    if (!shown.length) h += '<div class="card empty" style="text-align:center">' + (f === 'wrong' ? 'ไม่มีข้อที่ผิด 🎉' : 'ไม่มีข้อในหมวดนี้') + '</div>';
    shown.forEach(function (r) {
      var it = r.it;
      var stTxt = r.st === 'ok' ? 'ถูก' : r.st === 'no' ? 'ผิด' : 'ไม่ได้ตอบ';
      h += '<article class="card rv"><div class="q-meta"><span class="q-num">ข้อ ' + (r.i + 1) + '</span>' +
        '<span class="status ' + r.st + '">' + stTxt + '</span>' +
        (done.flags[r.x.id] ? '<span class="tag" style="color:var(--warn)">ปักธง</span>' : '') +
        '<span class="tag">บทที่ ' + (it.ch + 1) + ' · ข้อ ' + (it.idx + 1) + '</span></div>';
      h += questionBody(it) + '<div class="choices">';
      r.x.order.forEach(function (orig, pos) {
        var cls = 'choice', mark = '';
        if (orig === it.answer) { cls += ' correct'; mark = '✓ เฉลย'; }
        else if (orig === r.a) { cls += ' picked-wrong'; mark = '✗ คุณเลือก'; }
        if (orig === it.answer && orig === r.a) mark = '✓ คุณเลือก';
        h += '<div class="' + cls + '"><span class="letter">' + LETTERS[pos] + '</span><span class="ctext">' + esc(it.choices[orig]) + '</span>' +
          (mark ? '<span class="mark">' + mark + '</span>' : '') + '</div>';
      });
      h += '</div><div class="expl"><b>คำอธิบาย</b>' + esc(it.expl) + '</div></article>';
    });
    h += '</div>';
    if (counts.wrong) h += '<div style="padding-bottom:40px"><button class="btn primary block" data-act="retry-wrong">' + I.redo + 'ทำใหม่เฉพาะข้อที่ผิด (' + counts.wrong + ')</button></div>';
    h += '</main>';
    app.innerHTML = h;
  }

  // ---------- การนำทาง ----------
  function go(v) {
    view = v;
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    stopTimer();
    if (view === 'exam' && exam) { renderExam(); startTimer(); }
    else if (view === 'result' && done) renderResult();
    else if (view === 'review' && done) renderReview();
    else { view = 'home'; renderHome(); }
  }

  // ---------- เหตุการณ์ ----------
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var v = t.dataset.v;
    switch (t.dataset.act) {
      case 'theme': {
        var next = themeIsDark() ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        S.set('theme', next);
        render();
        break;
      }
      case 'mode': prefs.mode = v; savePrefs(); renderHome(); break;
      case 'ch-all': prefs.chapters = bank.chapters.map(function (c) { return c.i; }); savePrefs(); renderHome(); break;
      case 'ch-none': prefs.chapters = []; savePrefs(); renderHome(); break;
      case 'n': prefs.n = +v; savePrefs(); renderHome(); break;
      case 'time': prefs.minutes = +v; savePrefs(); renderHome(); break;
      case 'start':
        if (loadExam('current')) {
          modal({ title: 'เริ่มชุดใหม่?', body: 'ข้อสอบที่ทำค้างไว้จะถูกทิ้ง', ok: 'เริ่มชุดใหม่', danger: true }).then(function (ok) {
            if (ok) startFromPrefs();
          });
        } else startFromPrefs();
        break;
      case 'practice': {
        var ch = +v;
        var go2 = function () { prefs.mode = 'chapters'; prefs.chapters = [ch]; savePrefs(); startFromPrefs(); };
        if (loadExam('current')) {
          modal({ title: 'เริ่มชุดใหม่?', body: 'ข้อสอบที่ทำค้างไว้จะถูกทิ้ง', ok: 'เริ่มชุดใหม่', danger: true }).then(function (ok) { if (ok) go2(); });
        } else go2();
        break;
      }
      case 'resume':
        exam = loadExam('current');
        if (!exam) { renderHome(); break; }
        if (exam.endsAt && remainingSec(exam) <= 0) submitExam();
        else go('exam');
        break;
      case 'discard':
        modal({ title: 'ทิ้งข้อสอบที่ทำค้างไว้?', body: 'คำตอบทั้งหมดในชุดนี้จะหายไป และไม่บันทึกในประวัติ', ok: 'ทิ้ง', danger: true }).then(function (ok) {
          if (ok) { S.del('current'); renderHome(); }
        });
        break;
      case 'clear-history':
        modal({ title: 'ล้างประวัติการสอบทั้งหมด?', body: 'ลบแล้วกู้คืนไม่ได้', ok: 'ล้างประวัติ', danger: true }).then(function (ok) {
          if (ok) { S.del('history'); renderHome(); }
        });
        break;
      case 'exit': exam = null; go('home'); break;
      case 'pick': {
        var id = exam.items[exam.cur].id;
        exam.answers[id] = +v;
        saveExam();
        renderExam();
        break;
      }
      case 'clear': delete exam.answers[exam.items[exam.cur].id]; saveExam(); renderExam(); break;
      case 'flag': {
        var fid = exam.items[exam.cur].id;
        if (exam.flags[fid]) delete exam.flags[fid]; else exam.flags[fid] = true;
        saveExam();
        renderExam();
        break;
      }
      case 'prev': gotoQ(exam.cur - 1); break;
      case 'next': gotoQ(exam.cur + 1); break;
      case 'goto': gotoQ(+v); break;
      case 'pal-open': ui.paletteOpen = true; renderExam(); break;
      case 'pal-close': ui.paletteOpen = false; renderExam(); break;
      case 'submit': confirmSubmit(); break;
      case 'review': ui.filter = 'all'; go('review'); break;
      case 'result': go('result'); break;
      case 'home': go('home'); break;
      case 'filter': ui.filter = v; renderReview(); break;
      case 'retry-wrong': {
        var g = E.grade(bank, done);
        startExam(E.withPrereqs(bank, g.wrongIds), 'retry');
        break;
      }
    }
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.ch !== undefined) {
      var c = +t.dataset.ch;
      prefs.chapters = prefs.chapters.filter(function (x) { return x !== c; });
      if (t.checked) prefs.chapters.push(c);
      prefs.chapters.sort(function (a, b) { return a - b; });
      savePrefs();
      t.closest('.ch-item').classList.toggle('on', t.checked);
      updateHomeSummary();
    }
    if (t.id === 'n-input') renderHome();
  });
  app.addEventListener('input', function (e) {
    if (e.target.id !== 'n-input') return;
    var n = parseInt(e.target.value, 10);
    if (isNaN(n)) return;
    prefs.n = Math.max(1, Math.min(bank.items.length, n));
    savePrefs();
    updateHomeSummary();
    document.querySelectorAll('[data-act="n"]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === prefs.n)); });
  });

  document.addEventListener('keydown', function (e) {
    if (view !== 'exam' || !exam || modalRoot.firstChild) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    var x = exam.items[exam.cur];
    if (/^[1-4]$/.test(e.key)) {
      exam.answers[x.id] = x.order[+e.key - 1];
      saveExam(); renderExam();
    } else if (e.key === 'ArrowRight') { gotoQ(exam.cur + 1); }
    else if (e.key === 'ArrowLeft') { gotoQ(exam.cur - 1); }
    else if (e.key === 'f' || e.key === 'F' || e.key === 'ด') {
      if (exam.flags[x.id]) delete exam.flags[x.id]; else exam.flags[x.id] = true;
      saveExam(); renderExam();
    } else if (e.key === 'Escape' && ui.paletteOpen) { ui.paletteOpen = false; renderExam(); }
  });

  // ตามธีมระบบเมื่อผู้ใช้ยังไม่ได้เลือกเอง
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!document.documentElement.dataset.theme) render();
  });

  done = loadExam('last');
  render();

  // สำหรับสคริปต์ทดสอบ
  window.__app = { bank: bank, state: function () { return { view: view, exam: exam, done: done }; } };
})();
