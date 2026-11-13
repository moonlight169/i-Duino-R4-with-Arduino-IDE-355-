// ตัวไฮไลต์ C++/Arduino ขนาดเล็ก (ไม่ต้องพึ่งไลบรารีภายนอก)
(function () {
  'use strict';
  function words(s) { var o = {}; s.split(/\s+/).forEach(function (w) { o[w] = true; }); return o; }

  var KEYWORDS = words('if else for while do switch case default break continue return goto sizeof new delete ' +
    'const static volatile extern struct class public private protected namespace using typedef enum template');
  var TYPES = words('void int long short char float double bool boolean byte word unsigned signed String ' +
    'uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t size_t auto');
  var CONSTS = words('true false HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN NULL nullptr ' +
    'A0 A1 A2 A3 A4 A5 DEC HEX BIN OCT');

  // 1 คอมเมนต์ | 2 สตริง | 3 preprocessor | 4 ตัวเลข | 5 ชื่อ
  var TOK = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|(\b0[xX][0-9a-fA-F]+\b|\b0[bB][01]+\b|\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?[fFuUlL]*\b)|([A-Za-z_]\w*)/gm;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function span(cls, s) { return '<span class="tk-' + cls + '">' + esc(s) + '</span>'; }

  function highlightCpp(code) {
    var out = '', last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1]) out += span('com', m[1]);
      else if (m[2]) out += span('str', m[2]);
      else if (m[3]) out += span('pre', m[3]);
      else if (m[4]) out += span('num', m[4]);
      else {
        var w = m[5];
        if (KEYWORDS[w]) out += span('kw', w);
        else if (TYPES[w]) out += span('type', w);
        else if (CONSTS[w]) out += span('const', w);
        else if (/^\s*\(/.test(code.slice(TOK.lastIndex))) out += span('fn', w);
        else out += esc(w);
      }
      last = TOK.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  window.highlightCpp = highlightCpp;
})();
