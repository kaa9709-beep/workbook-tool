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
// needNotes false: a workbook without answers (예문장).
function readFrame(files, what, needNotes = true) {
  const sec = files['Contents/section0.xml'] && dec8(files['Contents/section0.xml']);
  if (!sec) throw new Error('한글 파일 안에 본문(section0)이 없어요.');
  const header = dec8(files['Contents/header.xml']), ps = topParas(sec);
  const masters = Object.keys(files).filter(n => /^Contents\/masterpage\d+\.xml$/.test(n)), mx = masters.map(n => dec8(files[n]));
  const lesson = mx.map(x => (x.match(/<hp:t>(Lesson\b[^<]*)<\/hp:t>/i) || [])[1]).find(Boolean);
  const notes = [...sec.matchAll(NOTE_RE)];
  if (needNotes && !notes.length) throw new Error(`템플릿에 미주가 없어요. 미주로 정답을 단 ${what} 파일을 넣어 주세요.`);
  return { sec, header, ps, notes, masters, lesson: lesson && hwpText(lesson), lessonXml: lesson, academy: academyOf(mx),
    white: new Set([...header.matchAll(/<hh:charPr id="(\d+)"[^>]*textColor="#FFFFFF"/g)].map(m => m[1])) };
}
// needAnswer false: no ANSWER part; the file just ends after the new body (예문장).
function frameParts(F, titleAt, from, englishXmls, missing, needBlank = true, needAnswer = true) {
  // The ANSWER part: from the "ANSWER" line, or the page-break / column-switch line right above it
  // (문장 빈칸 switches to 2 columns there; 문단 빈칸 just starts a page). No "ANSWER" line: from the last column switch.
  let endAt = -1;
  if (needAnswer) {
    F.ps.forEach((p, i) => { if (i > from && /^answers?$/i.test(p.text)) endAt = i; });
    if (endAt < 0) F.ps.forEach((p, i) => { if (i > from && p.xml.includes('<hp:colPr')) endAt = i; });
    else if (!F.ps[endAt - 1].text && /pageBreak="1"|<hp:colPr/.test(F.ps[endAt - 1].xml)) endAt--;
    if (endAt < 0) missing.push('ANSWER 부분');
  }
  const blankId = topChars(englishXmls, id => F.white.has(id)), textId = topChars(englishXmls, id => !F.white.has(id));
  if (!textId) missing.push('보통 글씨 모양');
  if (needBlank && !blankId) missing.push('빈칸(흰 글씨) 모양');
  if (missing.length) throw new Error('템플릿에서 ' + missing.join(', ') + '을(를) 찾지 못했어요.');
  const start = F.sec.slice(0, F.ps[titleAt].start);
  return { start, end: F.sec.slice(needAnswer ? F.ps[endAt].start : F.ps[F.ps.length - 1].end), blankId, textId, page: firstPage(start),
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
// the spaces between them ordinary (the underline is per word, like the templates). Hyphens, apostrophes and other
// punctuation stay ordinary too, so they show in a blank (non-profit, 사용자 결정); keep = false marks the whole word
// (answers in a 미주).
const markWord = (s, blankId, textId, keep) => keep ? hwpRun(blankId, xmlEsc(s))
  : s.split(/([^A-Za-z0-9]+)/).filter(Boolean).map(x => hwpRun(/^[A-Za-z0-9]/.test(x) ? blankId : textId, xmlEsc(x))).join('');
const blankRuns = (body, blankId, textId, keep = false) => body.split(/\s+/).map(w => {
  const m = w.match(/^\((.+?)\)(.*)$/);
  return m ? hwpRun(textId, xmlEsc(m[1])) + markWord(m[2], blankId, textId, keep) : markWord(w, blankId, textId, keep);
}).join(hwpRun(textId, ' '));
const textRun = (id, s) => s ? hwpRun(id, xmlEsc(s)) : '';

// ── 문장 빈칸 ──

// Finds the parts of a finished 문장 빈칸 (or 어법 선택형, same layout): title, English with 미주, 해석, an empty line
// between sentences and how many of them the template has, the 미주 paragraphs, and the style of "[a/b]" brackets.
function readSentenceTemplate(files, what = '문장 빈칸', needBlank = true) {
  const F = readFrame(files, what), ps = F.ps, enAt = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  let t = enAt - 1;
  while (t >= 0 && !ps[t].text) t--;
  const after = ps.slice(enAt + 1), koAt = after.findIndex(p => p.text), ko = after[koAt];
  const blank = after.find((p, i) => i > koAt && !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="0"/.test(p.xml));
  // 미주: "1) answer" paragraphs; the first one of a 본문 also carries the title ("본문 1") in a paragraph of its own.
  const numPara = F.notes.map(noteParas).flat().find(p => p.xml.includes('<hp:autoNum'));
  const titled = F.notes.map(noteParas).find(x => x.length > 1 && !x[0].xml.includes('<hp:autoNum'));
  const missing = [t < 0 && '첫 제목', !ko && '해석 문단', !blank && '빈 줄', !numPara && '미주 번호'].filter(Boolean);
  const style = enAt >= 0 && ps[enAt].xml.match(/styleIDRef="(\d+)"/)[1];
  const enXmls = ps.filter(p => style && p.xml.includes(`styleIDRef="${style}"`)).map(p => p.xml);
  const T = frameParts(F, t, enAt, enXmls, missing, needBlank);
  let gap = 0; // empty lines after the first 해석, up to the next sentence
  for (let i = koAt + 1; i < after.length && !after[i].text && !/pageBreak="1"/.test(after[i].xml); i++) gap++;
  const markId = topChars(enXmls.map(x => x.replace(/<hp:run charPrIDRef="\d+"><hp:t>(?!\[)[\s\S]*?<\/hp:run>/g, '')), () => true);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], en: ps[enAt].xml, ko: ko.xml, koId: runIds(ko.xml)[0], blank: blank.xml, gap, markId,
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
// example: 예문장 빈칸 (수업용 자료) — the same layout from its own template, with the template's number of empty lines
// between sentences (문장 빈칸 always has 3, 사용자 결정), and passages without the repeat marking.
function sentenceFile(files, secs, o = {}, example = false) {
  const T = example ? readSentenceTemplate(files, '예문장 빈칸') : readSentenceTemplate(files), body = [], state = { k: 0, inst: 1000, gap: false };
  const between = example ? T.gap || SENT_GAP : SENT_GAP;
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
      if (j) for (let g = 0; g < between; g++) body.push(T.blank);
      const restart = j ? '' : `<hp:run charPrIDRef="${T.textId}"><hp:ctrl><hp:newNum num="1" numType="ENDNOTE"/></hp:ctrl></hp:run>`;
      body.push(hwpPara(T.en, restart + sentenceRuns(T, st.en, state, s.title || ''), false));
      body.push(hwpPara(T.ko, hwpRun(T.koId, xmlEsc(st.ko || '')), false));
    });
  }
  return finishFile(files, T, body, o);
}

// ── 어법 선택형 ──

const readChoiceTemplate = files => readSentenceTemplate(files, '어법 선택형', false);

// data: choiceMap() of 어법.html. Like 문장 빈칸: a 미주 before each "[ a / b ]" (numbered from 1 in each 본문, the first
// with the title), 해석 under each sentence, the template's number of empty lines between sentences, each 본문 on a new page.
// The brackets keep the template's look (bold, underlined) with a fixed-width space around [ / ] (사용자 결정).
function choiceFile(files, data, o = {}) {
  const T = readChoiceTemplate(files), body = [], FW = '<hp:fwSpace/>';
  let inst = 1000;
  data.secs.forEach((s, i) => {
    if (i) body.push(hwpPara(T.blank, inner8(T.blank), true));
    body.push(hwpPara(T.title, hwpRun(T.titleId, xmlEsc(s.title || '')), false));
    s.sents.forEach((st, j) => {
      if (j) for (let g = 0; g < (T.gap || SENT_GAP); g++) body.push(T.blank);
      const restart = j ? '' : `<hp:run charPrIDRef="${T.textId}"><hp:ctrl><hp:newNum num="1" numType="ENDNOTE"/></hp:ctrl></hp:run>`;
      const runs = st.parts.map(x => typeof x === 'string' ? textRun(T.textId, x)
        : `<hp:run charPrIDRef="${T.textId}">${sentenceNote(T, x.n, x.answer, x.n === 1 ? s.title || '' : '', inst++, i > 0)}</hp:run>`
          + hwpRun(T.markId || T.textId, '[' + FW + x.shown.map(xmlEsc).join(FW + '/' + FW) + FW + ']')).join('');
      body.push(hwpPara(T.en, restart + runs, false));
      body.push(hwpPara(T.ko, hwpRun(T.koId, xmlEsc(st.ko || '')), false));
    });
  });
  return finishFile(files, T, body, o);
}

// ── 어법 고치기 ──

// Finds the parts of a finished 어법 고치기: title ("본문 1 (4개)"), passage paragraph that starts with the hidden 미주,
// the page-starting empty line, and inside the 미주 the title, passage text and marked (red, bold, underlined) corrections.
function readFixTemplate(files) {
  const F = readFrame(files, '어법 고치기'), ps = F.ps, enAt = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  let t = enAt - 1;
  while (t >= 0 && !ps[t].text) t--;
  const en = ps[enAt], enStyle = en && en.xml.match(/styleIDRef="(\d+)"/)[1];
  const enXmls = ps.filter(p => enStyle && p.xml.includes(`styleIDRef="${enStyle}"`)).map(p => p.xml);
  const page = ps.slice(enAt + 1).find(p => !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="1"/.test(p.xml));
  const noteRun = en && (en.xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '').match(/<hp:run charPrIDRef="(\d+)">(?:(?!<\/hp:run>)[\s\S])*?<hp:ctrl><hp:endNote /) || [])[1];
  const all = F.notes.map(noteParas).flat().filter(p => p.text);
  const nTitle = all.find(p => p.text.length < 30 && !/[.!?]/.test(p.text)), nBody = all.find(p => p !== nTitle && p.text.length >= 30);
  const marked = id => /underline type="BOTTOM"/.test(charOf(F.header, id));
  const bodyXmls = all.filter(p => p !== nTitle && p.text.length >= 30).map(p => p.xml);
  const ansId = topChars(bodyXmls, marked), plainId = topChars(bodyXmls, id => !marked(id));
  const missing = [t < 0 && '첫 제목', !en && '지문 문단', !page && '쪽 나눔 빈 줄', !noteRun && '지문 앞의 미주', !nTitle && '미주 제목', !(nBody && ansId && plainId) && '미주 정답 표시(밑줄)'].filter(Boolean);
  const T = frameParts(F, t, enAt, enXmls, missing, false);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], en: en.xml, noteRun, pageLine: page.xml,
    noteOpen: F.notes[0][0].match(/^<hp:endNote [^>]*>/)[0], subOpen: F.notes[0][1].match(/^<hp:subList [^>]*>/)[0],
    noteTitle: nTitle.xml, noteTitleId: runIds(nTitle.xml)[0], noteBody: nBody.xml, ansId, plainId,
  });
}

// data: fixMap() of 어법.html. Per 본문 one page: "본문 1 (4개)", the passages with the wrong forms; the hidden 미주 at the start
// of the first passage holds the title and the corrected passages, corrections marked; several right answers as
// "breathing [또는 she breathed]" (사용자 결정), words to delete as "삭제: in".
function fixFile(files, data, o = {}) {
  const T = readFixTemplate(files), body = [], FW = '<hp:fwSpace/>';
  const newPage = () => hwpPara(T.pageLine, inner8(T.pageLine), true);
  const MARK = /\u0000(\d+)\u0000([^\u0000]*)\u0000/g;
  data.secs.forEach((s, i) => {
    const title = xmlEsc(s.title || '');
    const answer = p => fixTidy(p.str).split(/(\u0000\d+\u0000[^\u0000]*\u0000)/).filter(Boolean).map(part => {
      const m = part.match(/^\u0000(\d+)\u0000/);
      if (!m) return textRun(T.plainId, part);
      const x = p.items[+m[1]];
      return hwpRun(T.ansId, x.alts.length ? xmlEsc(x.alts[0]) + (x.alts.length > 1 ? FW + '[또는 ' + x.alts.slice(1).map(xmlEsc).join(', ') + ']' : '') : '삭제: ' + xmlEsc(x.wrong));
    }).join('');
    const head = (i ? hwpPara(T.noteTitle, `<hp:run charPrIDRef="${T.noteTitleId}"/>`) : '') + hwpPara(T.noteTitle, hwpRun(T.noteTitleId, title));
    const note = noteXml(T, i + 1, 1000 + i, head + s.paras.map(p => hwpPara(T.noteBody, answer(p))).join(''));
    if (i) body.push(newPage());
    body.push(hwpPara(T.title, hwpRun(T.titleId, xmlEsc(`${s.title ? s.title + ' ' : ''}(${s.n}개)`)), false));
    s.paras.forEach((p, j) => body.push(hwpPara(T.en, (j ? '' : `<hp:run charPrIDRef="${T.noteRun}">${note}</hp:run>`)
      + textRun(T.textId, fixTidy(p.str.replace(MARK, '$2'))), false)));
  });
  return finishFile(files, T, body, o);
}

// ── 영작 (배열 · 통영작) ──

// Finds the parts of a finished 배열 영작 / 통영작: title, 해석 line that starts with the 미주 (its number is the sentence
// number), English line, empty lines between sentences (count from the template), page-starting empty line, 미주 lines,
// and the look of the brackets (배열: bold "[ a / b ]") or blanks (통영작: white words).
function readWriteTemplate(files, what, full) {
  const F = readFrame(files, what), ps = F.ps, koAt = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  let t = koAt - 1;
  while (t >= 0 && !ps[t].text) t--;
  const after = ps.slice(koAt + 1), enAt = after.findIndex(p => p.text), en = after[enAt];
  const enStyle = en && en.xml.match(/styleIDRef="(\d+)"/)[1];
  const enXmls = ps.filter(p => enStyle && p.xml.includes(`styleIDRef="${enStyle}"`)).map(p => p.xml);
  const blank = after.find((p, i) => i > enAt && !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="0"/.test(p.xml));
  const page = after.find(p => !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="1"/.test(p.xml));
  let gap = 0;
  for (let i = enAt + 1; i < after.length && !after[i].text && !/pageBreak="1"/.test(after[i].xml); i++) gap++;
  const ko = ps[koAt], noteRun = ko && (ko.xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '').match(/<hp:run charPrIDRef="(\d+)">(?:(?!<\/hp:run>)[\s\S])*?<hp:ctrl><hp:endNote /) || [])[1];
  const numPara = F.notes.map(noteParas).flat().find(p => p.xml.includes('<hp:autoNum'));
  const titled = F.notes.map(noteParas).flat().find(p => p.text && !p.xml.includes('<hp:autoNum') && p.text.length < 30);
  const markId = full ? null : topChars(enXmls.map(x => x.replace(/<hp:run charPrIDRef="\d+"><hp:t>(?!\[)[\s\S]*?<\/hp:run>/g, '')), () => true);
  const missing = [t < 0 && '첫 제목', !en && '영어 문장', !blank && '빈 줄', !page && '쪽 나눔 빈 줄', !noteRun && '해석 앞의 미주', !numPara && '미주 번호', !full && !markId && '배열 괄호 글씨'].filter(Boolean);
  const T = frameParts(F, t, koAt, full ? enXmls : enXmls.map(x => x.replace(new RegExp(`<hp:run charPrIDRef="${markId}">[\\s\\S]*?<\\/hp:run>`, 'g'), '')), missing, full);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], ko: ko.xml, noteRun, en: en.xml, blank: blank.xml, pageLine: page.xml, gap, markId,
    noteOpen: F.notes[0][0].match(/^<hp:endNote [^>]*>/)[0], subOpen: F.notes[0][1].match(/^<hp:subList [^>]*>/)[0],
    num: numPara.xml, numId: runIds(numPara.xml)[0], fmt: numPara.xml.match(/<hp:autoNumFormat [^>]*\/>/)[0],
    noteTitle: titled ? titled.xml : numPara.xml, noteTitleId: titled ? runIds(titled.xml)[0] : runIds(numPara.xml)[0],
  });
}
// 통영작 blank: letters and numbers in the blank style; apostrophes, quotation marks and other punctuation stay visible
// (friend’s → friend ’ s, ‘final frontiers’), like the originals.
const fullBlank = (T, words) => blankRuns(words, T.blankId, T.textId);
const readArrangeTemplate = files => readWriteTemplate(files, '배열 영작', false);
const readFullTemplate = files => readWriteTemplate(files, '통영작', true);

// data: writeMap() of 영작.html. Per sentence: "1) 해석" where 1) is the 미주 (numbered from 1 in each 본문; the first also
// carries the title, from 본문 2 on with an empty line above it), then the English with "[ a / b ]" or white-word blanks.
function writeFile(files, data, o, full) {
  const T = full ? readFullTemplate(files) : readArrangeTemplate(files), body = [];
  let inst = 1000;
  data.secs.forEach((s, i) => {
    if (i) body.push(hwpPara(T.pageLine, inner8(T.pageLine), true));
    body.push(hwpPara(T.title, hwpRun(T.titleId, xmlEsc(s.title || '')), false));
    s.sents.forEach((st, j) => {
      if (j) for (let g = 0; g < (T.gap || SENT_GAP); g++) body.push(T.blank);
      const restart = j ? '' : `<hp:run charPrIDRef="${T.noteRun}"><hp:ctrl><hp:newNum num="1" numType="ENDNOTE"/></hp:ctrl></hp:run>`;
      const note = sentenceNote(T, st.n, st.answer, st.n === 1 ? s.title || '' : '', inst++, i > 0);
      body.push(hwpPara(T.ko, restart + `<hp:run charPrIDRef="${T.noteRun}">${note}<hp:t> ${xmlEsc(st.ko || '')}</hp:t></hp:run>`, false));
      body.push(hwpPara(T.en, st.parts.map(x => typeof x === 'string' ? textRun(T.textId, x)
        : full ? fullBlank(T, x.units.join(' ')) : hwpRun(T.markId, xmlEsc(`[ ${x.order.join(' / ')} ]`))).join(''), false));
    });
  });
  return finishFile(files, T, body, o);
}

// ── 예문장 (수업용 자료) ──

// Finds the parts of a finished 예문장: title, a word-list line ("explore: v. 탐험하다"), the sentence with the target words
// marked (bold, underlined), its 해석, an empty line, the page-starting empty line. No 미주, no ANSWER.
const EX_GAP = 5; // empty lines (for notes) between sentences, 사용자 결정
function readExampleTemplate(files) {
  const F = readFrame(files, '예문장', false), ps = F.ps;
  const marked = id => /underline type="BOTTOM"/.test(charOf(F.header, id));
  const enAt = ps.findIndex(p => /[A-Za-z]/.test(p.text) && !p.text.includes(':') && runIds(p.xml).some(marked));
  let t = enAt - 1;
  while (t >= 0 && (!ps[t].text || ps[t].text.includes(':'))) t--;
  const vocab = ps.slice(t + 1, enAt).find(p => p.text.includes(':'));
  const after = ps.slice(enAt + 1), koAt = after.findIndex(p => p.text), ko = after[koAt];
  const blank = after.find((p, i) => i > koAt && !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="0"/.test(p.xml));
  const page = after.find(p => !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="1"/.test(p.xml));
  const enStyle = enAt >= 0 && ps[enAt].xml.match(/styleIDRef="(\d+)"/)[1];
  const enXmls = ps.filter(p => enStyle && p.xml.includes(`styleIDRef="${enStyle}"`)).map(p => p.xml);
  const markId = topChars(enXmls, marked), plainId = topChars(enXmls, id => !marked(id));
  const missing = [enAt < 0 && '타깃 어휘(굵게·밑줄) 예문', t < 0 && '첫 제목', !vocab && '단어 목록 줄', !ko && '해석 문단', !blank && '빈 줄', !page && '쪽 나눔 빈 줄', !markId && '타깃 어휘 글씨'].filter(Boolean);
  const T = frameParts(F, t, enAt, enXmls, missing, false, false);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], vocab: vocab.xml, vocabId: runIds(vocab.xml)[0],
    en: ps[enAt].xml, markId, textId: plainId || T.textId, ko: ko.xml, koId: runIds(ko.xml)[0], blank: blank.xml, pageLine: page.xml,
  });
}

// data: exampleMap() of 수업.html. Per 본문 a new page: title; per sentence its word lines, the sentence with the target
// words marked, the 해석, then 5 empty lines before the next sentence.
function exampleFile(files, data, o = {}) {
  const T = readExampleTemplate(files), body = [];
  data.secs.forEach((s, i) => {
    if (i) body.push(hwpPara(T.pageLine, inner8(T.pageLine), true));
    body.push(hwpPara(T.title, hwpRun(T.titleId, xmlEsc(s.title || '')), false));
    s.sents.forEach((st, j) => {
      if (j) for (let g = 0; g < EX_GAP; g++) body.push(T.blank);
      st.lines.forEach(l => body.push(hwpPara(T.vocab, hwpRun(T.vocabId, xmlEsc(l)), false)));
      body.push(hwpPara(T.en, st.parts.map(x => typeof x === 'string' ? textRun(T.textId, x) : hwpRun(T.markId, xmlEsc(x.body))).join(''), false));
      body.push(hwpPara(T.ko, hwpRun(T.koId, xmlEsc(st.ko || '')), false));
    });
  });
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
    return answer ? blankRuns(body, T.ansId, T.plainId, true) : blankRuns(body, T.blankId, T.textId);
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

// ── 동사 지도 ──

// Finds the parts of a finished 동사 지도: title with the hidden 미주, passage paragraph ("➊ ( fascinate )" with the base in bold),
// the "▼" line, the answer table (the 4-column one if there is one), the page-starting empty line, and the 미주's title / answer lines.
const CIRC_RE = /[➊-➓⓫-⓴]/;
function readVerbTemplate(files) {
  const F = readFrame(files, '동사 지도'), ps = F.ps, t = ps.findIndex(p => p.xml.includes('<hp:endNote '));
  const after = ps.slice(t + 1), en = after.find(p => p.text && !p.xml.includes('<hp:tbl '));
  const enStyle = en && en.xml.match(/styleIDRef="(\d+)"/)[1];
  const enXmls = ps.filter(p => enStyle && p.xml.includes(`styleIDRef="${enStyle}"`)).map(p => p.xml);
  const arrow = after.find(p => p.text && p.text.length <= 2 && !/[A-Za-z가-힣]/.test(p.text) && !p.xml.includes('<hp:tbl '));
  const tables = after.filter(p => p.xml.includes('<hp:tbl ')), table = tables.find(p => /colCnt="4"/.test(p.xml)) || tables[0];
  const page = after.find(p => !p.text && !p.xml.includes('<hp:ctrl>') && /pageBreak="1"/.test(p.xml));
  const noteRun = (ps[t].xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '').match(/<hp:run charPrIDRef="(\d+)">(?:(?!<\/hp:run>)[\s\S])*?<hp:ctrl><hp:endNote /) || [])[1];
  // the bold base: runs starting with "("; the 미주 lines: a short title and "➊ answer" lines
  const baseId = topChars(enXmls.map(x => x.replace(/<hp:run charPrIDRef="\d+"><hp:t>(?!\()[\s\S]*?<\/hp:run>/g, '')), () => true);
  const all = F.notes.map(noteParas).flat().filter(p => p.text);
  const nTitle = all.find(p => !CIRC_RE.test(p.text[0])), nItem = all.find(p => CIRC_RE.test(p.text[0]));
  const missing = [!en && '지문 문단', !table && '답 쓰는 표', !page && '쪽 나눔 빈 줄', !noteRun && '제목의 미주', !baseId && '굵은 원형 글씨', !nTitle && '미주 제목', !nItem && '미주 정답 줄'].filter(Boolean);
  const T = frameParts(F, t, t, enXmls.map(x => x.replace(new RegExp(`<hp:run charPrIDRef="${baseId}">[\\s\\S]*?<\\/hp:run>`, 'g'), '')), missing, false);
  return Object.assign(T, {
    title: ps[t].xml, titleId: runIds(ps[t].xml)[0], noteRun, en: en.xml, baseId, fw: enXmls.some(x => /[➊-➓⓫-⓴]<hp:fwSpace\/>/.test(x)),
    arrow: arrow ? arrow.xml : '', table: table.xml, pageLine: page.xml,
    noteOpen: F.notes[0][0].match(/^<hp:endNote [^>]*>/)[0], subOpen: F.notes[0][1].match(/^<hp:subList [^>]*>/)[0],
    noteTitle: nTitle.xml, noteTitleId: runIds(nTitle.xml)[0], noteItem: nItem.xml, noteItemId: runIds(nItem.xml)[0],
  });
}

// The answer table for n questions: the template's table with as many rows as needed. A 4-column table holds two
// number+answer pairs per row, numbers going down the left pair first (➊…➑ | ➒…⓰), like the template.
function verbTable(T, n, id) {
  const p = T.table.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
  const tbl = p.match(/<hp:tbl [\s\S]*<\/hp:tbl>/)[0], row = tbl.match(/<hp:tr>[\s\S]*?<\/hp:tr>/)[0];
  const cols = +tbl.match(/colCnt="(\d+)"/)[1], pairs = Math.max(1, Math.floor(cols / 2)), rows = Math.ceil(n / pairs);
  const height = +(row.match(/<hp:cellSz width="\d+" height="(\d+)"/) || [0, 0])[1];
  const num = i => i <= n ? circ8(i) : '';
  const trs = Array.from({ length: rows }, (_, r) => row.replace(/<hp:tc [\s\S]*?<\/hp:tc>/g, tc => {
    const c = +tc.match(/colAddr="(\d+)"/)[1];
    tc = tc.replace(/rowAddr="\d+"/, `rowAddr="${r}"`);
    // number cells are the even columns; answer cells stay empty
    return c % 2 ? tc : tc.replace(/<hp:t>[^<]*<\/hp:t>|<hp:t\/>/, num(Math.floor(c / 2) * rows + r + 1) ? `<hp:t>${num(Math.floor(c / 2) * rows + r + 1)}</hp:t>` : '<hp:t/>');
  })).join('');
  const newTbl = tbl.replace(/^<hp:tbl [^>]*>/, m => m.replace(/rowCnt="\d+"/, `rowCnt="${rows}"`).replace(/ id="\d+"/, ` id="${id}"`))
    .replace(/(<hp:sz width="\d+" widthRelTo="\w+" height=")\d+/, `$1${rows * height}`)
    .replace(/<hp:tr>[\s\S]*<\/hp:tr>/, trs);
  return p.replace(/<hp:tbl [\s\S]*<\/hp:tbl>/, newTbl);
}
const circ8 = i => '➊➋➌➍➎➏➐➑➒➓⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴'[i - 1] || `(${i})`;

// data: verbMap() of 어법.html — per 본문 its paragraphs (text pieces and { n, base, answer }) and answer lines.
function verbFile(files, data, o = {}) {
  const T = readVerbTemplate(files), body = [], FW = T.fw ? '<hp:fwSpace/>' : ' ';
  const newPage = () => hwpPara(T.pageLine, inner8(T.pageLine), true);
  let inst = 1000, tableId = 1932025616;
  data.secs.forEach((s, i) => {
    const title = xmlEsc(s.title || '');
    // the 미주: title (from 본문 2 on with an empty line above it), then "➊ were fascinated" lines
    const head = (i ? hwpPara(T.noteTitle, `<hp:run charPrIDRef="${T.noteTitleId}"/>`) : '') + hwpPara(T.noteTitle, hwpRun(T.noteTitleId, title));
    const note = noteXml(T, i + 1, inst++, head + s.answers.map(x => hwpPara(T.noteItem, hwpRun(T.noteItemId, xmlEsc(x)))).join(''));
    if (i) body.push(newPage());
    body.push(hwpPara(T.title, hwpRun(T.titleId, title) + `<hp:run charPrIDRef="${T.noteRun}">${note}</hp:run>`, false));
    s.paras.forEach(p => body.push(hwpPara(T.en, p.map(x => typeof x === 'string' ? textRun(T.textId, x)
      : hwpRun(T.textId, x.n + FW) + hwpRun(T.baseId, '(' + FW + xmlEsc(x.base) + FW + ')')).join(''), false)));
    if (T.arrow) body.push(T.arrow);
    body.push(verbTable(T, s.answers.length, tableId++));
  });
  return finishFile(files, T, body, o);
}

const FILE_KINDS = {
  sentence: { read: readSentenceTemplate, make: sentenceFile },
  paragraph: { read: readParagraphTemplate, make: paragraphFile },
  verb: { read: readVerbTemplate, make: verbFile },
  choice: { read: readChoiceTemplate, make: choiceFile },
  fix: { read: readFixTemplate, make: fixFile },
  arrange: { read: readArrangeTemplate, make: (f, d, o) => writeFile(f, d, o, false) },
  full: { read: readFullTemplate, make: (f, d, o) => writeFile(f, d, o, true) },
  example: { read: readExampleTemplate, make: exampleFile },
  exblank: { read: f => readSentenceTemplate(f, '예문장 빈칸'), make: (f, d, o) => sentenceFile(f, d, o, true) },
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
