// ตรรกะข้อสอบ: คลังข้อ, กลุ่มข้อที่อ้างถึงกัน, สุ่ม, ตรวจคะแนน, สถิติ (ไม่ยุ่งกับ DOM)
(function () {
  'use strict';

  // โจทย์ที่ขึ้นต้นแบบนี้ต้องอยู่คู่กับข้อก่อนหน้าเสมอ
  var REF_RE = /^\s*จาก(?:โค้ด)?ข้อที่แล้ว/;

  function buildBank(raw) {
    var items = [], byId = {}, units = [];
    var chapters = raw.map(function (c, i) {
      return { i: i, title: c.title, short: c.title.replace(/^\d+\.\s*/, ''), count: c.questions.length };
    });
    raw.forEach(function (ch, ci) {
      var unit = null;
      ch.questions.forEach(function (q, qi) {
        var it = {
          id: ci + '-' + qi, ch: ci, idx: qi,
          q: q.q, code: q.code || null, choices: q.choices, answer: q.answer, expl: q.expl,
          prevId: null, prevCode: null
        };
        if (qi > 0 && REF_RE.test(q.q)) {
          it.prevId = ci + '-' + (qi - 1);
          var p = byId[it.prevId];
          it.prevCode = p.code || p.prevCode;
          unit.ids.push(it.id);
        } else {
          unit = { ch: ci, ids: [it.id] };
          units.push(unit);
        }
        items.push(it);
        byId[it.id] = it;
      });
    });
    return { chapters: chapters, items: items, byId: byId, units: units };
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // เรียงตามบท แล้วตามลำดับเดิมในบท
  function sortIds(bank, ids) {
    return ids.slice().sort(function (a, b) {
      var x = bank.byId[a], y = bank.byId[b];
      return x.ch - y.ch || x.idx - y.idx;
    });
  }

  function idsOfChapters(bank, chapters) {
    var set = {};
    chapters.forEach(function (c) { set[c] = true; });
    return bank.items.filter(function (it) { return set[it.ch]; }).map(function (it) { return it.id; });
  }

  // สุ่ม N ข้อโดยเลือกทีละ "กลุ่ม" ข้อที่อ้างถึงกันจึงไม่ถูกแยก
  function pickRandom(bank, n, rng) {
    n = Math.max(1, Math.min(n, bank.items.length));
    var picked = [], rest = [], left = n;
    shuffle(bank.units, rng).forEach(function (u) {
      if (left > 0 && u.ids.length <= left) { picked.push(u); left -= u.ids.length; }
      else rest.push(u);
    });
    // ถ้าเหลือช่องว่างแต่มีแต่กลุ่มใหญ่กว่า: เอาข้อเดี่ยวออกแล้วใส่กลุ่มนั้นแทน ให้ได้ครบ N พอดี
    if (left > 0) {
      for (var r = 0; r < rest.length; r++) {
        var need = rest[r].ids.length - left;
        var singles = picked.filter(function (u) { return u.ids.length === 1; });
        if (singles.length >= need) {
          var drop = singles.slice(0, need);
          picked = picked.filter(function (u) { return drop.indexOf(u) < 0; });
          picked.push(rest[r]);
          left = 0;
          break;
        }
      }
    }
    var ids = [];
    picked.forEach(function (u) { ids = ids.concat(u.ids); });
    return sortIds(bank, ids);
  }

  // เติมข้อก่อนหน้าให้ข้อที่ "จากโค้ดข้อที่แล้ว"
  function withPrereqs(bank, ids) {
    var set = {};
    ids.forEach(function add(id) {
      if (set[id]) return;
      set[id] = true;
      var p = bank.byId[id].prevId;
      if (p) add(p);
    });
    return sortIds(bank, Object.keys(set));
  }

  function createExam(bank, ids, meta, rng) {
    var now = Date.now();
    var minutes = meta.minutes || 0;
    var chs = {};
    ids.forEach(function (id) { chs[bank.byId[id].ch] = true; });
    return {
      key: now,
      mode: meta.mode,
      label: meta.label,
      chapters: Object.keys(chs).map(Number).sort(function (a, b) { return a - b; }),
      minutes: minutes,
      startedAt: now,
      endsAt: minutes ? now + minutes * 60000 : null,
      items: ids.map(function (id) {
        return { id: id, order: shuffle([0, 1, 2, 3], rng) }; // order[ตำแหน่งที่แสดง] = ดัชนีตัวเลือกต้นฉบับ
      }),
      answers: {}, // id -> ดัชนีตัวเลือกต้นฉบับ
      flags: {},   // id -> true
      cur: 0
    };
  }

  function grade(bank, exam) {
    var per = {}, correct = 0, wrongIds = [], unanswered = 0;
    exam.items.forEach(function (x) {
      var it = bank.byId[x.id];
      var p = per[it.ch] || (per[it.ch] = [0, 0]);
      p[1]++;
      var a = exam.answers[x.id];
      if (a === undefined) unanswered++;
      if (a === it.answer) { correct++; p[0]++; }
      else wrongIds.push(x.id);
    });
    var total = exam.items.length;
    return {
      correct: correct, total: total, unanswered: unanswered,
      pct: total ? Math.round((correct / total) * 1000) / 10 : 0,
      per: per, wrongIds: wrongIds
    };
  }

  // สถิติรายบทจากประวัติ: ถ่วงน้ำหนักครั้งล่าสุดมากกว่า (0.7^k)
  function chapterStats(history, nChapters) {
    var acc = [];
    for (var i = 0; i < nChapters; i++) acc.push({ ch: i, w: 0, c: 0, t: 0, attempts: 0, last: null });
    // history เก็บใหม่สุดไว้ก่อน
    history.forEach(function (h) {
      Object.keys(h.per || {}).forEach(function (k) {
        var a = acc[+k];
        if (!a) return;
        var p = h.per[k];
        var w = Math.pow(0.7, a.attempts);
        a.c += w * p[0]; a.t += w * p[1];
        if (a.last === null) a.last = p[1] ? p[0] / p[1] : 0;
        a.attempts++;
      });
    });
    return acc.map(function (a) {
      return { ch: a.ch, attempts: a.attempts, pct: a.t ? Math.round((a.c / a.t) * 100) : null, last: a.last };
    });
  }

  function makeLabel(bank, mode, chapters, n) {
    if (mode === 'random') return 'สุ่ม ' + n + ' ข้อจากทุกบท';
    if (mode === 'retry') return 'ทำใหม่ข้อที่ผิด (' + n + ' ข้อ)';
    if (chapters.length === bank.chapters.length) return 'ทุกบท (' + n + ' ข้อ)';
    if (chapters.length === 1) return 'บทที่ ' + (chapters[0] + 1) + ' ' + bank.chapters[chapters[0]].short;
    return 'บทที่ ' + chapters.map(function (c) { return c + 1; }).join(', ');
  }

  window.ExamCore = {
    buildBank: buildBank, shuffle: shuffle, sortIds: sortIds, idsOfChapters: idsOfChapters,
    pickRandom: pickRandom, withPrereqs: withPrereqs, createExam: createExam, grade: grade,
    chapterStats: chapterStats, makeLabel: makeLabel
  };
})();
