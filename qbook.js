// 문제집 서식 입히기: the user's draft 문제집 (.hwpx written in 한글) gets the look of a finished 문제집 (the template).
// Text, 굵게 / 기울임 / 밑줄, 미주 (answers) and tables stay as written; font, size, 자간 (0) and paragraph shapes come
// from the template. Needs hwpx.js. Rules (사용자 결정 2026-11-03):
//   문제 줄 = has a 미주 → the template's numbered question paragraph (no 미주 but 문제 style and ending in ? / 시오: warned)
//   "[1~10] 다음 글을 읽고…" (묶음 안내) and "Part 01." → plain paragraph, bold as written, new page
//   ①~⑤ and "(1) … [T/F]" → 내어쓰기 (the template's own amount)
//   long English paragraph → 지문: first-line indent, leading spaces dropped, its underlines not bold
//   anything else → the template's plain paragraph; table cells keep their alignment; 미주 → the template's 미주 look
//   New page before a Part, a 묶음 안내 and a 문제 with its own 지문; other page breaks the user sets in 한글.

const qDec = b => new TextDecoder().decode(b);
const most = arr => { const c = {}; arr.forEach(x => { if (x !== undefined) c[x] = (c[x] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; };
const defOf = (header, tag, id) => (header.match(new RegExp(`<hh:${tag} id="${id}"[\\s\\S]*?</hh:${tag}>`)) || [''])[0];
const intentOf = def => +((def.match(/<hc:intent value="(-?\d+)"/) || [])[1] || 0);
const alignOf = def => (def.match(/<hh:align horizontal="(\w+)"/) || [])[1];
const paraId = tag => tag.match(/paraPrIDRef="(\d+)"/)[1];
const NOTES = /<hp:endNote [\s\S]*?<\/hp:endNote>/g; // the space: not <hp:endNotePr>
const TABLES = /<hp:tbl\b[\s\S]*?<\/hp:tbl>/g;
// The paragraph's own words: no 미주, no table.
const ownText = x => hwpText(x.replace(NOTES, '').replace(TABLES, '')).trim();
const hasNote = x => x.replace(TABLES, '').includes('<hp:endNote ');
const plainChar = def => !/<hh:bold\/>|<hh:italic\/>|<hh:underline type="(?!NONE)/.test(def);

// What the finished 문제집 gives: its paragraph and letter styles by role, the start (page setup) and the ANSWER part.
function readBookTemplate(files) {
  const sec = files['Contents/section0.xml'] && qDec(files['Contents/section0.xml']);
  if (!sec) throw new Error('한글 파일 안에 본문(section0)이 없어요.');
  const header = qDec(files['Contents/header.xml']), ps = topParas(sec);
  const qs = ps.filter(p => hasNote(p.xml));
  if (!qs.length) throw new Error('템플릿에 미주(정답)가 달린 문제가 없어요. 완성된 문제집 파일을 넣어 주세요.');
  const P = id => defOf(header, 'paraPr', id), tagOf = p => p.xml.match(/<hp:p [^>]*>/)[0];
  const body = ps.filter(p => ownText(p.xml) && !qs.includes(p));
  const bodyIds = body.map(p => paraId(tagOf(p)));
  const plain = most(bodyIds.filter(id => !intentOf(P(id)) && alignOf(P(id)) === 'JUSTIFY' && /<hh:heading type="NONE"/.test(P(id))));
  const passage = most(bodyIds.filter(id => intentOf(P(id)) > 0));
  const hangs = body.filter(p => /^[①-⑤]/.test(ownText(p.xml))).map(p => intentOf(P(paraId(tagOf(p))))).filter(v => v < 0).sort((a, b) => a - b);
  // letters: the most used plain style outside 미주 and tables
  const count = {};
  ps.forEach(p => { for (const r of p.xml.replace(NOTES, '').replace(TABLES, '').matchAll(/<hp:run charPrIDRef="(\d+)">([\s\S]*?)<\/hp:run>/g)) count[r[1]] = (count[r[1]] || 0) + hwpText(r[2]).length; });
  const text = Object.keys(count).filter(id => plainChar(defOf(header, 'charPr', id))).sort((a, b) => count[b] - count[a])[0];
  const notes = sec.match(NOTES), noteTags = notes.flatMap(n => n.match(/<hp:p [^>]*>/g) || []);
  const cellIds = (sec.match(TABLES) || []).flatMap(t => (t.match(/<hp:p [^>]*>/g) || []).map(paraId));
  const missing = [!plain && '보통 문단', !passage && '지문(첫 줄 들여쓰기) 문단', !text && '보통 글씨'].filter(Boolean);
  if (missing.length) throw new Error('템플릿에서 ' + missing.join(', ') + '을(를) 찾지 못했어요.');
  // the ANSWER part: from the "ANSWER" line (or the empty page-break / column line right above it), else the last column switch
  let endAt = -1;
  ps.forEach((p, i) => { if (i && /^answers?$/i.test(ownText(p.xml))) endAt = i; });
  if (endAt < 0) ps.forEach((p, i) => { if (i && p.xml.includes('<hp:colPr')) endAt = i; });
  else if (!ps[endAt - 1].text && /pageBreak="1"|<hp:colPr/.test(ps[endAt - 1].xml)) endAt--;
  if (endAt < 1) throw new Error('템플릿 끝의 ANSWER 부분을 찾지 못했어요.');
  // the first paragraph holds the page setup; its own words and 미주 (if any) are not kept
  const first = ps[0].xml.replace(NOTES, '').replace(/<hp:t>[\s\S]*?<\/hp:t>/g, '<hp:t/>').replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/, '');
  return {
    header, plain, passage, text, hang: hangs.length ? hangs[hangs.length >> 1] : -2870,
    question: most(qs.map(p => paraId(tagOf(p)))),
    notePara: most(noteTags.map(paraId)), noteStyle: most(noteTags.map(t => t.match(/styleIDRef="(\d+)"/)[1])),
    noteText: most(notes.flatMap(n => [...n.matchAll(/<hp:run charPrIDRef="(\d+)"/g)].map(m => m[1])).filter(id => plainChar(defOf(header, 'charPr', id)))),
    center: most(cellIds.filter(id => alignOf(P(id)) === 'CENTER')) || plain,
    start: sec.slice(0, ps[0].start) + first, end: sec.slice(ps[endAt].start),
    masters: Object.keys(files).filter(n => /^Contents\/masterpage\d+\.xml$/.test(n)),
  };
}

// 바탕쪽 words the user may change (교재 이름, 과, 학교·학년 …): every text there except the 학원 line,
// "김진혁 영어", letter-spaced mottos and punctuation. Exact XML text → shown text.
function bookFields(files, T) {
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const all = T.masters.flatMap(n => [...qDec(files[n]).matchAll(/<hp:t>([^<]+)<\/hp:t>/g)].map(m => m[1]));
  return [...new Set(all)].filter(t => t.trim().length > 1 && !/대치하이|센티움|김진혁 영어/.test(t) && !/^\s*(\S {1,3})+\S?\s*$/.test(t))
    .map(raw => ({ raw, text: unesc(raw) }));
}

// New styles go after the template's own; one already there with the same look is used instead.
function headerKit(header) {
  const lists = { charPr: 'charProperties', paraPr: 'paraProperties', borderFill: 'borderFills' };
  const sig = d => d.replace(/^<hh:\w+ id="\d+"/, ''), known = {}, extra = {}, next = {};
  for (const t in lists) {
    known[t] = new Map(); extra[t] = []; next[t] = 0;
    for (const m of header.matchAll(new RegExp(`<hh:${t} id="(\\d+)"[\\s\\S]*?</hh:${t}>`, 'g'))) {
      next[t] = Math.max(next[t], +m[1] + 1);
      if (!known[t].has(sig(m[0]))) known[t].set(sig(m[0]), m[1]);
    }
  }
  const put = (t, def) => {
    const s = sig(def);
    if (!known[t].has(s)) { const id = String(next[t]++); known[t].set(s, id); extra[t].push(def.replace(/^(<hh:\w+ id=")\d+/, '$1' + id)); }
    return known[t].get(s);
  };
  const done = () => Object.keys(lists).reduce((h, t) => !extra[t].length ? h : h.replace(`</hh:${lists[t]}>`, extra[t].join('') + `</hh:${lists[t]}>`)
    .replace(new RegExp(`(<hh:${lists[t]} itemCnt=")(\\d+)`), (m, a, n) => a + (+n + extra[t].length)), header);
  return { put, done };
}

// 굵게 / 기울임 / 밑줄 / 취소선 / 위·아래 첨자 and a color of the draft's letters, put on a template letter style.
const MAIN_FLAGS = /<hh:italic\/>|<hh:bold\/>|<hh:underline type="(?!NONE)[^"]*"[^>]*\/>|<hh:strikeout shape="(?!NONE)[^"]*"[^>]*\/>/g;
function lookOf(header, kit, draftHeader, draftId, baseId, noBold) {
  const d = defOf(draftHeader, 'charPr', draftId), order = f => ['<hh:italic', '<hh:bold', '<hh:underline', '<hh:strikeout'].findIndex(o => f.startsWith(o));
  let flags = (d.match(MAIN_FLAGS) || []).sort((a, b) => order(a) - order(b));
  if (noBold && flags.some(f => f.startsWith('<hh:underline'))) flags = flags.filter(f => f !== '<hh:bold/>');
  const sup = (d.match(/<hh:(supscript|subscript)\/>/) || [''])[0], h = +(d.match(/ height="(\d+)"/) || [])[1];
  const color = (d.match(/textColor="([^"]*)"/) || [])[1];
  let def = defOf(header, 'charPr', baseId).replace(/<hh:(italic|bold|supscript|subscript)\/>|<hh:(underline|strikeout)\b[^>]*\/>/g, '')
    .replace(/(<hh:offset [^>]*\/>)/, '$1' + flags.join('')).replace('</hh:charPr>', sup + '</hh:charPr>');
  if (h && h < 800) def = def.replace(/ height="\d+"/, ` height="${h}"`); // tiny spacer letters stay tiny
  if (color && color !== '#000000') def = def.replace(/textColor="[^"]*"/, `textColor="${color}"`);
  return kit.put('charPr', def);
}

const LONG = 150; // shortcut: a 지문 is a paragraph of 150+ letters that is mostly English; a short 지문 stays plain (fix in 한글)
const isPassage = t => t.length >= LONG && (t.match(/[A-Za-z]/g) || []).length > t.replace(/[\s_]/g, '').length / 2;
// ①~⑤ at the start: a 선택지 when it is the only one in the paragraph and the list starts here (①) or goes on;
// "① (A)-(C)-(B) ② …" several short ones on a line too. A long paragraph with ①…⑤ inside is a 지문 (어법·어휘 밑줄).
const isChoice = (t, prev) => /^[①-⑤]/.test(t) && ((t.match(/[①-⑤]/g).length === 1) ? /^①/.test(t) || prev === 'hang' : t.length < LONG);
const GROUP_RE = /^\[\s*(\d+)\s*[~\-–]\s*(\d+)\s*\]|다음 글을 읽고/;

// files: the template's zip entries; draft: the draft's. o: { fields: { raw: new text }, academy }.
// → { bytes, warnings, head (the draft's 머리말 text), counts }
function bookFile(files, draft, o = {}) {
  const T = readBookTemplate(files), warnings = [];
  const dsec = draft['Contents/section0.xml'] && qDec(draft['Contents/section0.xml']);
  if (!dsec) throw new Error('초안 파일 안에 본문(section0)이 없어요.');
  const dh = qDec(draft['Contents/header.xml']), kit = headerKit(T.header);
  const qStyle = (dh.match(/<hh:style id="(\d+)" type="PARA" name="문제"/) || [])[1];
  // page setup, 머리말 and column settings of the draft go (the template's are used); pictures can't come along
  const strip = x => x.replace(/<hp:secPr\b[\s\S]*?<\/hp:secPr>/g, '')
    .replace(/<hp:ctrl><hp:(header|footer)\b[\s\S]*?<\/hp:\1><\/hp:ctrl>/g, '')
    .replace(/<hp:ctrl><hp:colPr\b[^>]*?(?:\/>|>[\s\S]*?<\/hp:colPr>)<\/hp:ctrl>/g, '')
    .replace(/<hp:ctrl><hp:(pageNum|newNum|pageHiding|pageNumCtrl)\b[^>]*\/><\/hp:ctrl>/g, '')
    .replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
  const headOf = x => hwpText((x.match(/<hp:header\b[\s\S]*?<\/hp:header>/) || [''])[0]).replace(/\s+/g, ' ').trim();
  let ps = topParas(dsec).map(p => ({ xml: strip(p.xml), head: headOf(p.xml) }));
  const head = ps.map(p => p.head).find(Boolean) || '';
  const ans = ps.findIndex(p => /^answers?$/i.test(ownText(p.xml))); // the draft's own ANSWER line (the template's is used)
  if (ans > 0) ps = ps.slice(0, ans);
  if (ps.some(p => /<hp:pic\b/.test(p.xml))) warnings.push('그림은 옮기지 못했어요. 한글에서 직접 넣어 주세요.');
  ps.forEach(p => { p.xml = p.xml.replace(/<hp:pic\b[\s\S]*?<\/hp:pic>/g, ''); p.text = ownText(p.xml); });

  const role = (p, prev) => /^Part\s*\d+/i.test(p.text) ? 'part' : hasNote(p.xml) ? 'q' : GROUP_RE.test(p.text) ? 'group'
    : isChoice(p.text, prev) || /^\(\d+\)/.test(p.text) && /\[\s*T\s*\/\s*F\s*\]/.test(p.text) ? 'hang' : isPassage(p.text) ? 'passage'
    : qStyle && p.xml.includes(`styleIDRef="${qStyle}"`) && /(\?|시오\.?)$/.test(p.text) ? 'q-' : 'plain';
  let last = '';
  ps.forEach(p => { p.role = role(p, last); if (p.text) last = p.role; });
  // new pages: a Part; a 묶음 안내 or a 문제 with its own 지문, unless a Part / 묶음 안내 just started the page
  let seen = false, prev = '';
  ps.forEach((p, i) => {
    if (!p.text && !p.xml.includes('<hp:tbl')) return;
    let own = false;
    if (p.role === 'q' || p.role === 'q-') for (let j = i + 1; j < ps.length && !/^(q|q-|group|part)$/.test(ps[j].role); j++) if (ps[j].role === 'passage') { own = true; break; }
    p.page = seen && (p.role === 'part' || (p.role === 'group' || own) && prev !== 'part' && prev !== 'group');
    seen = true; prev = p.role;
  });
  // question numbers (the template numbers them itself) against the "[11~14]" the draft wrote
  let n = 0;
  ps.forEach((p, i) => {
    if (p.role === 'q-') warnings.push(`정답(미주)이 없는 문제: "${p.text.slice(0, 40)}…"`);
    if (p.role === 'group') {
      const m = p.text.match(GROUP_RE), k = ps.slice(i + 1).findIndex(x => x.role === 'group' || x.role === 'part');
      const cnt = ps.slice(i + 1, k < 0 ? undefined : i + 1 + k).filter(x => x.role === 'q' || x.role === 'q-').length;
      if (m[1] && (+m[1] !== n + 1 || +m[2] !== n + cnt)) warnings.push(`"${m[0]}"이라고 적혀 있지만 자동 번호로는 ${n + 1}~${n + cnt}번이에요.`);
    }
    if (p.role === 'q' || p.role === 'q-') n++;
  });

  const hangPara = kit.put('paraPr', defOf(T.header, 'paraPr', T.plain).replace(/(<hc:intent value=")-?\d+/g, '$1' + T.hang));
  const borders = new Map(), looks = new Map();
  const look = (id, base, noBold) => { const k = id + '|' + base + '|' + noBold; if (!looks.has(k)) looks.set(k, lookOf(T.header, kit, dh, id, base, noBold)); return looks.get(k); };
  const paraOf = { q: T.question, 'q-': T.question, passage: T.passage, hang: hangPara, part: T.plain, group: T.plain, plain: T.plain };
  const body = ps.map(p => {
    let x = p.xml;
    if (p.role === 'passage') x = x.replace(/(<hp:t>)[  ]+/, '$1');
    const stack = [];
    return x.replace(/<hp:(endNote|subList)\b|<\/hp:(endNote|subList)>|<hp:p [^>]*>|<hp:run charPrIDRef="(\d+)"|borderFillIDRef="(\d+)"/g, (m, open, close, run, bf) => {
      if (open) { stack.push(open); return m; }
      if (close) { stack.pop(); return m; }
      const where = stack.includes('endNote') ? 'note' : stack.length ? 'cell' : 'top';
      if (bf) {
        if (!borders.has(bf)) borders.set(bf, kit.put('borderFill', defOf(dh, 'borderFill', bf)));
        return `borderFillIDRef="${borders.get(bf)}"`;
      }
      if (run) return `<hp:run charPrIDRef="${look(run, where === 'note' ? T.noteText : T.text, where === 'top' && p.role === 'passage')}"`;
      const pid = where === 'top' ? paraOf[p.role] : where === 'note' ? T.notePara : alignOf(defOf(dh, 'paraPr', paraId(m))) === 'CENTER' ? T.center : T.plain;
      let tag = m.replace(/paraPrIDRef="\d+"/, `paraPrIDRef="${pid}"`).replace(/styleIDRef="\d+"/, `styleIDRef="${where === 'note' ? T.noteStyle : 0}"`);
      if (where === 'top') tag = tag.replace(/pageBreak="\d"/, `pageBreak="${p.page ? 1 : 0}"`).replace(/columnBreak="\d"/, 'columnBreak="0"');
      return tag;
    });
  });
  // 미주 numbers in order (한글 counts them again anyway)
  let k = 0, a = 0;
  const sec = (T.start + body.join('') + T.end).replace(/<hp:endNote number="\d+"/g, () => `<hp:endNote number="${++k}"`)
    .replace(/<hp:autoNum num="\d+" numType="ENDNOTE">/g, () => `<hp:autoNum num="${++a}" numType="ENDNOTE">`);
  const out = Object.assign({}, files, { 'Contents/section0.xml': sec, 'Contents/header.xml': kit.done() });
  T.masters.forEach(name => {
    let x = qDec(files[name]);
    Object.entries(o.fields || {}).forEach(([raw, v]) => { if (v !== undefined) x = x.split('<hp:t>' + raw + '</hp:t>').join('<hp:t>' + xmlEsc(v) + '</hp:t>'); });
    out[name] = putAcademy(x, o.academy);
  });
  if (out['Preview/PrvText.txt']) out['Preview/PrvText.txt'] = '';
  const count = r => ps.filter(p => p.role === r).length;
  return { bytes: zip(out), warnings, head, paras: ps.map(p => ({ role: p.role, page: !!p.page, text: p.text })),
    counts: { 문제: count('q') + count('q-'), 지문: count('passage'), 새쪽: ps.filter(p => p.page).length } };
}
