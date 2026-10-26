// Shared by 어휘.html / 어법.html / 영작.html: input parsing, blank helpers, page wiring.
const BRACKET = /\[([^\]]*)\]/g;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = 'font-family:\'Malgun Gothic\',sans-serif;font-size:10pt;';
const P = `margin:0 0 6pt;line-height:180%;${FONT}`;
const KO = `margin:0 0 14pt;line-height:150%;font-size:9pt;color:#1f3a7a;font-family:'Malgun Gothic',sans-serif;`;
const TITLE = `margin:14pt 0 6pt;font-weight:bold;${FONT}`;

// Irregular forms → base, "base:form,form;...". Shared by 어휘 (repeat check) and 어법 (base forms).
// Forms with a second common meaning (saw, found, left, leaves, rose, lay...) are left out on purpose.
const IRREG = {};
('arise:arose,arisen;awake:awoke,awoken;beat:beaten;become:became;begin:began,begun;bend:bent;bite:bitten;bleed:bled;blow:blew,blown;' +
 'break:broke,broken;breed:bred;bring:brought;build:built;burn:burnt;buy:bought;catch:caught;choose:chose,chosen;cling:clung;come:came;' +
 'creep:crept;deal:dealt;dig:dug;do:done;draw:drew,drawn;dream:dreamt;drink:drank,drunk;drive:drove,driven;eat:ate,eaten;fall:fell,fallen;' +
 'feed:fed;feel:felt;fight:fought;flee:fled;fly:flew,flown;forbid:forbade,forbidden;foresee:foresaw,foreseen;forget:forgot,forgotten;' +
 'forgive:forgave,forgiven;freeze:froze,frozen;get:got,gotten;give:gave,given;go:went,gone;grow:grew,grown;hang:hung;hear:heard;' +
 'hide:hid,hidden;hold:held;keep:kept;kneel:knelt;know:knew,known;lay:laid;lead:led;leap:leapt;learn:learnt;lend:lent;lie:lain;light:lit;' +
 'lose:lost;make:made;mean:meant;meet:met;mislead:misled;mistake:mistook,mistaken;overcome:overcame;pay:paid;prove:proven;ride:rode,ridden;' +
 'ring:rang,rung;rise:risen;run:ran;say:said;see:seen;seek:sought;sell:sold;send:sent;sew:sewn;shake:shook,shaken;shine:shone;shoot:shot;' +
 'show:shown;shrink:shrank,shrunk;sing:sang,sung;sink:sank,sunk;sit:sat;sleep:slept;slide:slid;speak:spoke,spoken;speed:sped;spend:spent;' +
 'spill:spilt;spin:spun;spring:sprang,sprung;stand:stood;steal:stole,stolen;stick:stuck;sting:stung;stink:stank;strike:struck,stricken;' +
 'strive:strove,striven;swear:swore,sworn;sweep:swept;swell:swollen;swim:swam,swum;swing:swung;take:took,taken;teach:taught;tear:tore,torn;' +
 'tell:told;think:thought;throw:threw,thrown;understand:understood;undergo:underwent,undergone;undertake:undertook,undertaken;' +
 'wake:woke,woken;wear:wore,worn;weave:wove,woven;weep:wept;win:won;withdraw:withdrew,withdrawn;write:wrote,written;' +
 'child:children;man:men;woman:women;person:people;foot:feet;tooth:teeth;mouse:mice;goose:geese;knife:knives;wife:wives;half:halves;' +
 'wolf:wolves;shelf:shelves;thief:thieves;analysis:analyses;crisis:crises;hypothesis:hypotheses;phenomenon:phenomena;criterion:criteria;' +
 'medium:media;bacterium:bacteria;fungus:fungi;stimulus:stimuli;nucleus:nuclei;good:better,best;bad:worse,worst;far:farther,further'
).split(';').forEach(e => { const [base, forms] = e.split(':'); forms.split(',').forEach(f => { IRREG[f] = base; }); });

// A period after these is not a sentence end: Mr. Dr. e.g. U.S. a.m. J. (but not "I.").
const ABBR = /^["'“‘(\[]*(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|e\.g|i\.e|[A-HJ-Z]|([A-Za-z]\.)+[A-Za-z])\.$/;
// Splits a line at . ! ? — never inside [ ], and in English only before a capital letter.
function sentences(line, en) {
  const words = line.split(/\s+/), out = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1], s = cur.join(' ');
    if (next === undefined || !/[.!?]["'”’)\]]*$/.test(w)) return;
    if ((s.match(/\[/g) || []).length !== (s.match(/\]/g) || []).length) return;
    if ((s.match(/“/g) || []).length > (s.match(/”/g) || []).length || (s.match(/"/g) || []).length % 2) return; // inside a quote
    if (en && (ABBR.test(w) || !/^["'“‘(]*\[?[A-Z0-9]/.test(next))) return;
    out.push(s); cur = [];
  });
  if (cur.length) out.push(cur.join(' '));
  return out;
}

// Title: "# ..." / "본문 1 ..." / any short line with no [ ] and no sentence-ending punctuation ("14-E", "프린트 1번").
const isTitle = line => /^본문\s*\d/.test(line) || (line.length <= 30 && !/[\[\]]/.test(line) && !/[.!?]["'”’)]*$/.test(line));

// A line with 한글 (or starting with "=") is the 해석 of the English line above, even across a blank line;
// a blank line ends a paragraph. A multi-sentence English line is split into sentences and paired with its 해석 by count.
function parse(text) {
  const sections = [];
  sections.warns = [];
  let sec = null, para = null, group = null, gpara = null; // group: the sentences of the last English line, in gpara
  const newSec = title => { sec = { title, paras: [] }; para = group = null; sections.push(sec); };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { para = null; return; }
    if (line.startsWith('#')) return newSec(line.slice(1).trim());
    const hangul = /[가-힣]/.test(line.replace(BRACKET, ''));
    const awaitingKo = group && group.every(g => !g.ko);
    if (!line.startsWith('=') && !(hangul && awaitingKo) && (isTitle(line) || (hangul && !group))) return newSec(line);
    if (!sec) newSec('');
    if (line.startsWith('=') || hangul) {
      if (!group) return;
      const ko = line.replace(/^=/, '').trim();
      if (group.length === 1) { group[0].ko = (group[0].ko ? group[0].ko + ' ' : '') + ko; return; }
      const kos = sentences(ko, false);
      if (kos.length === group.length && group.every(g => !g.ko)) { group.forEach((g, j) => { g.ko = kos[j]; }); return; }
      // Counts differ: keep the whole line as one unit so nothing is mispaired.
      const merged = { en: group.map(g => g.en).join(' '), ko: [...group.map(g => g.ko).filter(Boolean), ko].join(' ') };
      gpara.splice(gpara.indexOf(group[0]), group.length, merged);
      sections.warns.push(`${i + 1}번째 줄: 영어 ${group.length}문장, 해석 ${kos.length}문장이라 짝을 못 지었어요. 한 덩어리로 묶어 두었으니 이 부분만 직접 줄을 나눠 주세요.`);
      group = [merged];
      return;
    }
    const sents = sentences(line, true);
    if (!para || sents.length > 1 || (group && group.length > 1)) { para = []; sec.paras.push(para); }
    group = sents.map(en => ({ en, ko: '' }));
    gpara = para;
    para.push(...group);
  });
  return sections;
}

function warnings(text) {
  const out = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const o = (l.match(/\[/g) || []).length, c = (l.match(/\]/g) || []).length;
    if (o !== c) out.push(`${i + 1}번째 줄: [ 와 ] 개수가 맞지 않습니다.`);
  });
  return out.concat(parse(text).warns);
}

// Underscore blank roughly 1.6x the word length, like the 180% 장평 in the hwp originals.
const line_ = n => '_'.repeat(Math.max(3, Math.round(n * 1.6)));
const hasBlank = s => /\[[^\]]*\]/.test(s.en);
// Superscript characters, not <sup>: 한글 drops paste formatting but keeps the characters.
const supNum = n => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]) + '⁾';
const title = (arr, t) => t && arr.push(`<p style="${TITLE}">${esc(t)}</p>`);

// A note is plain text, or { key, text, off } shown as a checkbox (ticked = auto-processed).
const noteHtml = n => typeof n === 'string' ? esc(n) :
  `<label><input type="checkbox" data-key="${esc(n.key)}"${n.off ? '' : ' checked'}> ${n.off ? `<s>${esc(n.text)}</s>` : esc(n.text)}</label>`;

// Browser only: hooks up radios, textarea, example button and copy buttons for one tool page.
// example: one text, or { mode: text } when each mode needs its own 전처리 — then the input is also kept per mode.
// onToggle(key, ticked) is called when a note checkbox changes; the page then re-renders.
function setupPage(build, example, storeKey, onToggle) {
  const $ = id => document.getElementById(id);
  const mode = () => document.querySelector('input[name=mode]:checked').value;
  const store = (k, v) => { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); } catch (e) {} return v; };
  const perMode = typeof example === 'object';
  const inputKey = () => storeKey + (perMode ? '-' + mode() : '') + '-input';

  function render() {
    const text = $('input').value;
    const r = build(mode(), text);
    $('outQ').innerHTML = r.q; $('outA').innerHTML = r.a;
    const titles = parse(text).map(s => s.title).filter(Boolean);
    $('warnings').innerHTML = (titles.length ? `<p class="note"><b>찾은 본문 ${titles.length}개</b>: ${titles.map(esc).join(' · ')}</p>` : '') +
      warnings(text).concat(r.warns || []).map(w => `<p class="warn">${esc(w)}</p>`).join('') +
      (r.notes && r.notes.length ? `<p class="note"><b>${r.notesTitle}</b>${r.notes.some(n => typeof n !== 'string') ? ' — 체크를 풀면 그 단어는 원래대로 둡니다.' : ''}<br>${r.notes.map(noteHtml).join('<br>')}</p>` : '');
    $('okQ').textContent = $('okA').textContent = '';
    store(inputKey(), text); store(storeKey + '-mode', mode());
  }

  // Selection + execCommand copies the formatted HTML, which 한글 keeps on paste; works from file:// too.
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => {
    const el = $(btn.dataset.copy), sel = getSelection(), range = document.createRange();
    range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range);
    const ok = document.execCommand('copy'); sel.removeAllRanges();
    const badge = $(btn.dataset.copy === 'outQ' ? 'okQ' : 'okA');
    badge.textContent = ok ? '복사됨' : '복사 실패: 직접 드래그해서 복사하세요';
    badge.classList.toggle('fail', !ok);
    clearTimeout(badge.timer);
    if (ok) badge.timer = setTimeout(() => { badge.textContent = ''; }, 3000);
  }));
  $('example').addEventListener('click', () => { $('input').value = perMode ? example[mode()] : example; render(); });
  $('input').addEventListener('input', render);
  $('modes').addEventListener('change', () => { if (perMode) $('input').value = store(inputKey()) || ''; render(); });
  $('warnings').addEventListener('change', e => {
    if (onToggle && e.target.dataset.key) { onToggle(e.target.dataset.key, e.target.checked); render(); }
  });

  const savedMode = store(storeKey + '-mode');
  const r = savedMode && document.querySelector(`input[name=mode][value="${savedMode}"]`);
  if (r) r.checked = true;
  $('input').value = store(inputKey()) || store(storeKey + '-input') || ''; // second: text saved before per-mode keys
  render();
}
