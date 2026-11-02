// 워크북 → 한글 파일(.hwpx) from the user's finished workbook as template. Needs common.js and hwpx.js.
// Blanks are the answer itself in white, underlined, wide letters (the template's own style); "(e)xplored" keeps the hint letter black.
// Answers are 미주, gathered under ANSWER at the end of the file. The 바탕쪽 과 제목, 학원 and first page number can be changed.
//   문장 빈칸: one 미주 per blank, numbered from 1 in each 본문; 3 empty lines between sentences.
//   문단 빈칸: per 본문 a page with 해석 and a page without; one hidden 미주 per 본문 holding the whole passage, answers marked.

const SENT_GAP = 3;
const dec8 = b => new TextDecoder().decode(b);
const inner8 = x => x.replace(/^<hp:p [^>]*>/, '').replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/, '').replace(/<\/hp:p>$/, '');
const NOTE_RE = /<hp:endNote [^>]*>([\s\S]*?)<\/hp:endNote>/g; // the space: not <hp:endNotePr>
const noteParas = n => topParas(n[1].replace(/^<hp:subList [^>]*>/, '').replace(/<\/hp:subList>$/, ''));
const charOf = (header, id) => { const i = header.indexOf(`<hh:charPr id="${id}"`); return i < 0 ? '' : header.slice(i, header.indexOf('</hh:charPr>', i)); };

// Most used char styles in the given paragraphs (미주 inside them left out), by letters: [the one passing test, …].
function topChars(xmls, test) {
  const count = {};
  xmls.forEach(x => {
    for (const r of x.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').matchAll(/<hp:run charPrIDRef="(\d+)">([\s\S]*?)<\/hp:run>/g)) count[r[1]] = (count[r[1]] || 0) + hwpText(r[2]).length;
  });
  return Object.keys(count).filter(test).sort((a, b) => count[b] - count[a])[0];
}

// What every workbook template shares: the file up to the first title, the ANSWER part (from the last paragraph
// that switches to columns), 바탕쪽, the first page number, and the blank / ordinary letters of the English.
function readFrame(files, what) {
  const sec = files['Contents/section0.xml'] && dec8(files['Contents/section0.xml']);
  if (!sec) throw new Error('한글 파일 안에 본문(section0)이 없어요.');
  const header = dec8(files['Contents/header.xml']), ps = topParas(sec);
  const masters = Object.keys(files).filter(n => /^Contents\/masterpage\d+\.xml$/.test(n)), mx = masters.map(n => dec8(files[n]));
  const lesson = mx.map(x => (x.match(/<hp:t>(Lesson\b[^<]*)<\/hp:t>/i) || [])[1]).find(Boolean);
  const notes = [...sec.matchAll(NOTE_RE)];
  if (!notes.length) throw new Error(`템플릿에 미주가 없어요. 미주로 정답을 단 ${what} 파일을 넣어 주세요.`);
  return { sec, header, ps, notes, masters, lesson: lesson && hwpText(lesson), lessonXml: lesson, academy: academyOf(mx),
    white: new Set([...header.matchAll(/<hh:charPr id="(\d+)"[^>]*textColor="#FFFFFF"/g)].map(m => m[1])) };
}
function frameParts(F, titleAt, from, englishXmls, missing) {
  // The ANSWER part: from the "ANSWER" line, or the page-break / column-switch line right above it
  // (문장 빈칸 switches to 2 columns there; 문단 빈칸 just starts a page). No "ANSWER" line: from the last column switch.
  let endAt = -1;
  F.ps.forEach((p, i) => { if (i > from && /^answers?$/i.test(p.text)) endAt = i; });
  if (endAt < 0) F.ps.forEach((p, i) => { if (i > from && p.xml.includes('<hp:colPr')) endAt = i; });
  else if (!F.ps[endAt - 1].text && /pageBreak="1"|<hp:colPr/.test(F.ps[endAt - 1].xml)) endAt--;
  if (endAt < 0) missing.push('ANSWER 부분');
  const blankId = topChars(englishXmls, id => F.white.has(id)), textId = topChars(englishXmls, id => !F.white.has(id));
  if (!blankId || !textId) missing.push('빈칸(흰 글씨)과 보통 글씨 모양');
  if (missing.length) throw new Error('템플릿에서 ' + missing.join(', ') + '을(를) 찾지 못했어요.');
  const start = F.sec.slice(0, F.ps[titleAt].start);
  return { start, end: F.sec.slice(F.ps[endAt].start), blankId, textId, page: firstPage(start),
    masters: F.masters, lesson: F.lesson, lessonXml: F.lessonXml, academy: F.academy };
}

// 쪽 번호 '새 번호로 시작' on the first page: page = a number sets it, null/0 drops it (pages count from 1), undefined keeps the template's.
// Templates can hold the same setting several times in a row; one is kept.
const PAGE_NUM = /<hp:ctrl><hp:newNum num="(\d+)" numType="PAGE"\/><\/hp:ctrl>/g;
const firstPage = start => +((start.match(new RegExp(PAGE_NUM.source)) || [])[1] || 0) || null;
function pageStart(start, page) {
  if (page === undefined) return start;
  const tag = page ? `<hp:ctrl><hp:newNum num="${page}" numType="PAGE"/></hp:ctrl>` : '';
  let done = false;
  const out = start.replace(PAGE_NUM, () => { const x = done ? '' : tag; done = true; return x; });
  // none in the template: put it in the first page's opening paragraph, before its text
  return done || !tag ? out : out.replace(/(<hp:run charPrIDRef="\d+">)(<hp:t\/>|<hp:t>)/, `$1${tag}$2`);
}

// The new file: template parts around the new body, 바탕쪽 과 제목 and 학원 changed.
function finishFile(files, T, body, o) {
  const out = Object.assign({}, files);
  out['Contents/section0.xml'] = pageStart(T.start, o.page) + body.join('') + T.end;
  T.masters.forEach(n => {
    let x = dec8(files[n]);
    if (T.lessonXml && o.lesson) x = x.split('<hp:t>' + T.lessonXml + '</hp:t>').join('<hp:t>' + xmlEsc(o.lesson) + '</hp:t>');
    out[n] = putAcademy(x, o.academy);
  });
  if (out['Preview/PrvText.txt']) out['Preview/PrvText.txt'] = o.lesson || '';
  return zip(out);
}

// A 미주 around the given paragraphs (number k; the template's tag and list settings).
const noteXml = (T, k, inst, paras) => '<hp:ctrl>' + T.noteOpen.replace(/number="\d+"/, `number="${k}"`).replace(/instId="\d+"/, `instId="${inst}"`) + T.subOpen + paras + '</hp:subList></hp:endNote></hp:ctrl>';

// The words of one [ ] as runs: each word in the blank style, "(e)xplored" with the hint letter in the ordinary style,
// the spaces between them ordinary (the underline is per word, like the templates).
const blankRuns = (body, blankId, textId) => body.split(/\s+/).map(w => {
  const m = w.match(/^\((.+?)\)(.*)$/);
  return m ? hwpRun(textId, xmlEsc(m[1])) + hwpRun(blankId, xmlEsc(m[2])) : hwpRun(blankId, xmlEsc(w));
}).join(hwpRun(textId, ' '));
const textRun = (id, s) => s ? hwpRun(id, xmlEsc(s)) : '';

// ── 문장 빈칸 ──

// Finds the parts of a finished 문장 빈칸: title, English with 미주, 해석, an empty line between sentences, the 미주 paragraphs.
function readSentenceTemplate(files) {
  const F = readFrame(files, '문장 빈칸'), ps = F.ps, enAt = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  let t = enAt - 1;
  while (t >= 0 && !ps[t].text) t--;
  const after = ps.slice(enAt + 1), koAt = after.findIndex(p => p.text), ko = after[koAt];
  const blank = after.find((p, i) => i > koAt && !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="0"/.test(p.xml));
  // 미주: "1) answer" paragraphs; the first one of a 본문 also carries the title ("본문 1") in a paragraph of its own.
  const numPara = F.notes.map(noteParas).flat().find(p => p.xml.includes('<hp:autoNum'));
  const titled = F.notes.map(noteParas).find(x => x.length > 1 && !x[0].xml.includes('<hp:autoNum'));
  const missing = [t < 0 && '첫 제목', !ko && '해석 문단', !blank && '빈 줄', !numPara && '미주 번호'].filter(Boolean);
  const style = enAt >= 0 && ps[enAt].xml.match(/styleIDRef="(\d+)"/)[1];
  const T = frameParts(F, t, enAt, ps.filter(p => style && p.xml.includes(`styleIDRef="${style}"`)).map(p => p.xml), missing);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], en: ps[enAt].xml, ko: ko.xml, koId: runIds(ko.xml)[0], blank: blank.xml,
    noteOpen: F.notes[0][0].match(/^<hp:endNote [^>]*>/)[0], subOpen: F.notes[0][1].match(/^<hp:subList [^>]*>/)[0],
    num: numPara.xml, numId: runIds(numPara.xml)[0], fmt: numPara.xml.match(/<hp:autoNumFormat [^>]*\/>/)[0],
    noteTitle: titled ? titled[0].xml : numPara.xml, noteTitleId: titled ? runIds(titled[0].xml)[0] : runIds(numPara.xml)[0],
  });
}

// One 미주: "1) were fascinated by"; the first of a 본문 starts with its title,
// and from 본문 2 on with one empty line above the title, apart from the previous 본문's last answer (사용자 요청).
function sentenceNote(T, k, answer, title, inst, gap) {
  const num = hwpPara(T.num, `<hp:run charPrIDRef="${T.numId}"><hp:ctrl><hp:autoNum num="${k}" numType="ENDNOTE">${T.fmt}</hp:autoNum></hp:ctrl><hp:t> ${xmlEsc(answer)}</hp:t></hp:run>`);
  const head = title ? (gap ? hwpPara(T.noteTitle, `<hp:run charPrIDRef="${T.noteTitleId}"/>`) : '') + hwpPara(T.noteTitle, hwpRun(T.noteTitleId, xmlEsc(title))) : '';
  return noteXml(T, k, inst, head + num);
}

// The English sentence as runs, a 미주 just before each blank.
function sentenceRuns(T, en, state, title) {
  const mine = [];
  let out = '';
  for (const part of en.split(/(\[[^\]]*\])/)) {
    if (!part.startsWith('[')) { out += textRun(T.textId, part); continue; }
    const raw = part.slice(1, -1).trim(), body = raw.replace(/^\+\s*/, '');
    if (raw.startsWith('+') && mine.length) mine[mine.length - 1].bodies.push(body); // [+...] joins the sentence's previous blank
    else {
      mine.push({ k: ++state.k, bodies: [body] });
      out += `<hp:run charPrIDRef="${T.textId}">\u0000${mine.length - 1}\u0000</hp:run>`;
    }
    out += blankRuns(body, T.blankId, T.textId);
  }
  // The 미주 go in last: their text needs every [+...] of the sentence first.
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => {
    const x = mine[+i];
    return sentenceNote(T, x.k, x.bodies.join(' / '), x.k === 1 ? title : '', state.inst++, state.gap);
  });
}

// secs: parsed 어휘 passages after the repeat marking (so "[(e)xplored]" blanks are already in st.en).
// o: { lesson, academy, page } for the 바탕쪽 and the first page number.
function sentenceFile(files, secs, o = {}) {
  const T = readSentenceTemplate(files), body = [], state = { k: 0, inst: 1000, gap: false };
  let first = true;
  for (const s of secs) {
    const sents = s.paras.flat().filter(st => /\[[^\]]*\]/.test(st.en));
    if (!sents.length) continue;
    if (!first) body.push(hwpPara(T.blank, inner8(T.blank), true)); // each 본문 on a new page, starting with one empty line like the template
    state.gap = !first;
    first = false;
    body.push(hwpPara(T.title, hwpRun(T.titleId, xmlEsc(s.title || '')), false));
    state.k = 0; // 미주 numbers start again at 1 in each 본문
    sents.forEach((st, j) => {
      if (j) for (let g = 0; g < SENT_GAP; g++) body.push(T.blank);
      const restart = j ? '' : `<hp:run charPrIDRef="${T.textId}"><hp:ctrl><hp:newNum num="1" numType="ENDNOTE"/></hp:ctrl></hp:run>`;
      body.push(hwpPara(T.en, restart + sentenceRuns(T, st.en, state, s.title || ''), false));
      body.push(hwpPara(T.ko, hwpRun(T.koId, xmlEsc(st.ko || '')), false));
    });
  }
  return finishFile(files, T, body, o);
}

// ── 문단 빈칸 ──

// Finds the parts of a finished 문단 빈칸: the title that carries the hidden 미주, English paragraph, 해석 paragraph,
// the empty line that starts a page, and inside the 미주 the title, passage text and marked-answer letters.
function readParagraphTemplate(files) {
  const F = readFrame(files, '문단 빈칸'), ps = F.ps, t = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  const after = ps.slice(t + 1), en = after.find(p => p.text);
  const enStyle = en && en.xml.match(/styleIDRef="(\d+)"/)[1];
  const ko = after.find(p => p.text && en && !p.xml.includes(`styleIDRef="${enStyle}"`) && /[가-힣]/.test(p.text));
  const page = after.find(p => !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="1"/.test(p.xml));
  const titleXml = ps[t].xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
  const noteRun = (titleXml.match(/<hp:run charPrIDRef="(\d+)">(?:(?!<\/hp:run>)[\s\S])*?<hp:ctrl><hp:endNote /) || [])[1];
  // 미주 paragraphs: the title one ("본문 1") and the passage ones; answers are the bold-underlined letters.
  const all = F.notes.map(noteParas).flat().filter(p => p.text);
  const nTitle = all.find(p => p.text.length < 30 && !/[.!?]/.test(p.text)), nBody = all.find(p => p !== nTitle && p.text.length >= 30);
  const marked = id => /underline type="BOTTOM"/.test(charOf(F.header, id));
  const bodyXmls = all.filter(p => p !== nTitle && p.text.length >= 30).map(p => p.xml);
  const ansId = topChars(bodyXmls, marked), plainId = topChars(bodyXmls, id => !marked(id));
  const missing = [!en && '영어 문단', !ko && '해석 문단', !page && '쪽 나눔 빈 줄', !noteRun && '제목의 미주', !nTitle && '미주 제목', !(nBody && ansId && plainId) && '미주 정답 표시(굵게·밑줄)'].filter(Boolean);
  const T = frameParts(F, t, t, ps.filter(p => enStyle && p.xml.includes(`styleIDRef="${enStyle}"`)).map(p => p.xml), missing);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], noteRun, en: en.xml, ko: ko.xml, koId: runIds(ko.xml)[0], page: T.page, pageLine: page.xml,
    noteOpen: F.notes[0][0].match(/^<hp:endNote [^>]*>/)[0], subOpen: F.notes[0][1].match(/^<hp:subList [^>]*>/)[0],
    noteTitle: nTitle.xml, noteTitleId: runIds(nTitle.xml)[0], noteBody: nBody.xml, ansId, plainId,
  });
}

// One English paragraph as runs: blanks in the white style, or (in the 미주) the answers marked.
function paragraphRuns(T, text, answer) {
  return text.split(/(\[[^\]]*\])/).map(part => {
    if (!part.startsWith('[')) return textRun(answer ? T.plainId : T.textId, part);
    const body = part.slice(1, -1).trim().replace(/^\+\s*/, '');
    return answer ? blankRuns(body, T.ansId, T.plainId) : blankRuns(body, T.blankId, T.textId);
  }).join('');
}

// Every 본문 twice: with 해석 (one 해석 paragraph per English paragraph), then on the next page without.
function paragraphFile(files, secs, o = {}) {
  const T = readParagraphTemplate(files), body = [];
  const newPage = () => hwpPara(T.pageLine, inner8(T.pageLine), true);
  let inst = 1000, k = 0;
  secs.forEach((s, i) => {
    const paras = s.paras.map(p => p.map(st => st.en).join(' ')), kos = s.paras.map(p => p.map(st => st.ko).filter(Boolean).join(' '));
    const title = xmlEsc(s.title || '');
    // the 미주: title (from 본문 2 on with an empty line above it, apart from the previous 본문), then the passage with the answers marked
    const head = (i ? hwpPara(T.noteTitle, `<hp:run charPrIDRef="${T.noteTitleId}"/>`) : '') + hwpPara(T.noteTitle, hwpRun(T.noteTitleId, title));
    const note = noteXml(T, ++k, inst++, head + paras.map(p => hwpPara(T.noteBody, paragraphRuns(T, p, true))).join(''));
    if (i) body.push(newPage());
    body.push(hwpPara(T.title, hwpRun(T.titleId, title) + `<hp:run charPrIDRef="${T.noteRun}">${note}</hp:run>`, false));
    paras.forEach(p => body.push(hwpPara(T.en, paragraphRuns(T, p, false), false)));
    kos.filter(Boolean).forEach(x => body.push(hwpPara(T.ko, hwpRun(T.koId, xmlEsc(x)), false)));
    body.push(newPage(), hwpPara(T.title, hwpRun(T.titleId, title), false));
    paras.forEach(p => body.push(hwpPara(T.en, paragraphRuns(T, p, false), false)));
  });
  return finishFile(files, T, body, o);
}

const FILE_KINDS = {
  sentence: { read: readSentenceTemplate, make: sentenceFile },
  paragraph: { read: readParagraphTemplate, make: paragraphFile },
};

// Browser: a "한글 파일" panel under the copy panel. The template stays in this computer's localStorage, never uploaded.
// kind: 'sentence' | 'paragraph'; getSecs(): the passages as the page has them now; active(): whether this panel shows.
// 학원 is shared by all panels; 과 제목 and page number are kept per kind.
function setupFilePanel(kind, label, getSecs, active) {
  const $ = id => document.getElementById(kind + '-' + id), K = FILE_KINDS[kind];
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const field = 'padding:8px 10px;font:inherit;border:1px solid var(--line);border-radius:9px';
  const lab = t => `<p style="margin:14px 0 4px;color:var(--muted);font-size:13px">${t}</p>`;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = `<h2>한글 파일 (${label}) <span><button id="${kind}-download">한글 파일 내려받기</button></span></h2>
    <p class="note" id="${kind}-info">완성된 ${label} 한글 파일(.hwpx)을 템플릿으로 한 번 등록하세요. 이 컴퓨터에만 저장됩니다.</p>
    <input type="file" id="${kind}-tpl" accept=".hwpx">
    ${lab('바탕쪽 과 제목 (홀수 쪽 위)')}<input type="text" id="${kind}-lesson" style="${field};width:100%">
    ${lab('바탕쪽 학원 ("김진혁 영어" 앞)')}
    <div>${ACADEMIES.map(a => `<label style="margin-right:14px;white-space:nowrap"><input type="radio" name="${kind}-academy" value="${a}"> ${a}</label>`).join('')}</div>
    ${lab("첫 쪽 번호 ('새 번호로 시작' · 비우면 1쪽부터 · 짝수 = 왼쪽, 홀수 = 오른쪽)")}<input type="number" min="1" id="${kind}-page" style="${field};width:100px">
    <div id="${kind}-warn"></div>`;
  document.querySelector('main').appendChild(panel);
  let files = null, tpl = null;
  const radios = () => document.querySelectorAll(`[name=${kind}-academy]`);
  const academy = () => (document.querySelector(`[name=${kind}-academy]:checked`) || {}).value || '';
  const setAcademy = v => radios().forEach(r => { r.checked = r.value === v; });
  const page = () => +$('page').value > 0 ? Math.floor(+$('page').value) : null;

  function refresh() {
    panel.style.display = active() ? '' : 'none';
    if (active()) setAcademy(academyName(store('wbfile-academy')) || academy()); // chosen in the other panel too
    $('download').disabled = !tpl;
    $('warn').innerHTML = tpl ? '' : '<p class="warn">템플릿을 먼저 등록하세요.</p>';
    store('wbfile-lesson-' + kind, $('lesson').value); store('wbfile-page-' + kind, $('page').value);
  }
  async function useTemplate(bytes, name, fresh) {
    try {
      files = await unzip(bytes); tpl = K.read(files);
      $('info').textContent = `등록된 템플릿: ${name}`;
      if (fresh || !$('lesson').value) $('lesson').value = tpl.lesson || '';
      if (fresh || !academy()) { setAcademy(tpl.academy); store('wbfile-academy', academy()); }
      if (fresh || !$('page').value) $('page').value = tpl.page || '';
      $('lesson').disabled = !tpl.lesson;
    } catch (e) { files = tpl = null; $('info').textContent = '템플릿을 쓸 수 없어요: ' + e.message; }
    refresh();
  }
  $('tpl').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    store('wbfile-' + kind, toB64(bytes)); store('wbfile-' + kind + '-name', f.name);
    useTemplate(bytes, f.name, true);
  });
  $('download').addEventListener('click', () => {
    const blob = new Blob([K.make(files, getSecs(), { lesson: $('lesson').value.trim(), academy: academy(), page: page() })], { type: 'application/hwp+zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ($('lesson').value.trim() || label).replace(/[\\/:*?"<>|]/g, '') + `_${label}.hwpx`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('lesson').value = store('wbfile-lesson-' + kind) || '';
  $('page').value = store('wbfile-page-' + kind) || '';
  ['lesson', 'page'].forEach(k => $(k).addEventListener('input', refresh));
  setAcademy(academyName(store('wbfile-academy')));
  radios().forEach(r => r.addEventListener('change', () => { store('wbfile-academy', academy()); refresh(); }));
  const saved = store('wbfile-' + kind);
  if (saved) useTemplate(fromB64(saved), store('wbfile-' + kind + '-name'), false); else refresh();
  return refresh;
}
