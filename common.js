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

// Verb dictionary and base forms: 어법 (동사 지도) and 수업용 자료 (예문장 원형).
// Base forms of common verbs (plus every base in IRREG): a suffix-stripping candidate counts only if it is listed here.
const VERBS = new Set((
  'abandon abolish absorb abuse accept access accompany accomplish accumulate accuse achieve acknowledge acquire act adapt add address adjust admire admit adopt adore advance advertise advise advocate affect afford age agree aid aim alarm alert allocate allow alter amaze amuse analyze announce annoy answer anticipate apologize appeal appear applaud apply appoint appreciate approach approve argue arrange arrest arrive ask assemble assert assess assign assist associate assume assure attach attack attain attempt attend attract attribute avoid await award ' +
  'bake balance ban bang bark base bathe battle beg behave believe belong benefit blame blend bless blink block board boast boil bomb book boost borrow bother bounce bow box brake breathe brush bubble budget bump burn burst bury buzz ' +
  'calculate call calm camp campaign cancel capture care carry carve cast cause celebrate challenge change charge charm chase chat cheat check cheer chew chop circle cite claim clap clarify classify clean clear click climb close coach collaborate collapse collect colonize combine comfort command comment commit communicate compare compel compensate compete compile complain complete comply compose comprehend compromise conceal concede conceive concentrate concern conclude condemn conduct confess confide confine confirm conflict conform confront confuse congratulate connect conquer consent conserve consider consist console constitute construct consult consume contact contain contaminate contemplate contend continue contract contradict contrast contribute control convert convey convict convince cook cooperate coordinate cope copy correct correspond cost cough count cover crack crash crawl create credit criticize cross crowd cry cultivate cure curse cut cycle ' +
  'damage dance dare date debate decay deceive decide declare decline decorate decrease dedicate deepen defeat defend define delay delete delight deliver demand demonstrate deny depart depend depict deposit deprive derive descend describe deserve design designate desire despise destroy detach detect deter determine develop devise devote diagnose dictate die differ digest diminish dine dip direct disagree disappear disappoint discard discharge discipline disclose discourage discover discriminate discuss disguise dislike dismiss display dispose dispute disrupt dissolve distinguish distort distract distribute disturb dive divide document dominate donate double doubt download drag drain dread dress drift drill drip drop drown dry dump dwell ' +
  'earn ease echo edit educate elaborate elect eliminate embarrass embrace emerge emit emphasize employ empower empty enable enclose encounter encourage end endanger endure enforce engage enhance enjoy enlarge enrich enroll ensure enter entertain entitle envy equip erase erupt escape establish estimate evaluate evaporate evolve exaggerate examine exceed excel exchange excite exclaim exclude excuse execute exercise exhaust exhibit exist exit expand expect expel experience experiment explain explode exploit explore export expose express extend extract ' +
  'face facilitate fade fail faint fancy fascinate fasten favor fear feature fetch file fill film filter finance fine finish fire fish fit fix flash flatter float flood flourish flow focus fold follow fool force forecast form formulate foster found frame free frighten frown frustrate fry fuel fulfill function fund furnish ' +
  'gain gather gaze generate gesture gift giggle glance glare glide glimpse glow glue govern grab grade graduate grant grasp greet grieve grin grip groan guarantee guard guess guide ' +
  'halt hammer handle happen harm harvest hate haunt head heal heap heat help hesitate hike hint hire honor hook hop hope host house hug hum hunt hurry hurt ' +
  'identify ignore illustrate imagine imitate immigrate impact implement imply import impose impress imprison improve include incorporate increase indicate induce indulge infect infer influence inform inhabit inherit inhibit initiate injure inquire insert insist inspect inspire install instruct insult insure integrate intend interact interest interfere interpret interrupt interview introduce invade invent invest investigate invite involve iron isolate issue ' +
  'jam join joke judge jump justify kick kill kiss knit knock ' +
  'label lack land last laugh launch lay lean lease lecture lessen let level license lick lie lift like limit line link list listen live load loan locate lock long look loosen love lower ' +
  'maintain manage manipulate manufacture march mark market marry master match matter mature maximize measure meditate melt memorize mention merge migrate mimic mind minimize miss mix moan mock model modify monitor motivate mount mourn move multiply murder ' +
  'nail name narrow navigate need neglect negotiate nod note notice notify nourish number nurse nurture ' +
  'obey object oblige observe obtain occupy occur offend offer omit open operate oppose opt order organize originate outline overlook owe own ' +
  'pack paint pant park participate pass paste pat pause pave peel perceive perform permit persist persuade phone photograph pick picture pile pin place plan plant play plead please pledge plot plow plug plunge point poison polish pollute ponder pop pose possess post postpone pour practice praise pray preach precede predict prefer prepare prescribe present preserve press presume pretend prevail prevent print prioritize proceed process proclaim produce profit program progress prohibit project prolong promise promote prompt pronounce propose prosper protect protest provide provoke publish pull pump punch punish purchase pursue push put puzzle ' +
  'qualify question queue quit quote ' +
  'race rain raise range rank rate reach react read realize reason reassure rebel recall receive recite recognize recommend reconcile record recover recruit recycle reduce refer reflect reform refresh refuse regain regard register regret regulate rehearse reign reinforce reject rejoice relate relax release relieve rely remain remark remedy remember remind remove render renew rent repair repeat replace reply report represent reproduce request require rescue research resemble resent reserve reside resign resist resolve respect respond rest restore restrict result resume retain retire retreat retrieve return reveal reverse review revise revive revolve reward rinse rip risk roar roast rob rock roll rot rotate row rub ruin rule rush ' +
  'sacrifice sail salute sample satisfy save scan scare scatter schedule scold score scratch scream screen search seat secure seem seize select sense separate serve set settle shape share shave shelter shift shiver shock shop shout shove shrug shut sigh sign signal simplify sip situate skate sketch ski skip slam slap slice slip smash smell smile smoke snap sneeze sniff soak sob solve sort sound spare spark spell spit splash split spoil sponsor spot spray spread squeeze stab stabilize stack stain stamp stare start starve state stay steer step stimulate stir stitch stop store stress stretch strip stroke struggle study stuff stumble submit substitute succeed suck suffer suggest suit summarize supervise supply support suppose suppress surf surge surprise surrender surround survey survive suspect suspend sustain swallow sway sweat switch symbolize sympathize ' +
  'tackle talk tap target taste tax tease telephone tempt tend terrify test thank thrill thrive tick tickle tie tighten tip tire tolerate top toss total touch tour trace track trade train transfer transform translate transmit transport trap travel treat tremble trigger trim trip triumph trouble trust try tumble turn twist type ' +
  'underline undo unfold unite unlock update upgrade upload upset urge use utilize vacuum value vanish vary venture verify view violate visit visualize volunteer vote ' +
  'wade wait walk wander want warm warn wash waste watch water wave weaken wed weigh welcome wet whisper whistle widen wipe wish witness wonder work worry worship wrap wrestle wrinkle yawn yell yield zoom'
).split(' ').concat(Object.values(IRREG)));
const BE = new Set('am is are was were been being be'.split(' ')), HAVE = new Set('has had having have'.split(' ')), DO = new Set('does did doing do'.split(' '));
// Verb forms that only 어법 needs (the 어휘 list leaves them out because they have a second meaning there).
const EXTRA = { born: 'bear', borne: 'bear', saw: 'see', left: 'leave', rose: 'rise', ground: 'grind', bit: 'bite' };
// Forms that are a verb of their own as well: the first is used, both are named in a warning.
const AMBIG = { found: ['find', 'found'], lay: ['lie', 'lay'], wound: ['wind', 'wound'], bore: ['bear', 'bore'], bound: ['bind', 'bound'] };

// One verb form → { base, sure, alts }. sure is false when the base is a guess (not in VERBS) or ambiguous.
function lemma(word) {
  const w = word.toLowerCase();
  if (BE.has(w)) return { base: 'be', sure: true };
  if (HAVE.has(w)) return { base: 'have', sure: true };
  if (DO.has(w)) return { base: 'do', sure: true };
  if (AMBIG[w]) return { base: AMBIG[w][0], sure: false, alts: AMBIG[w] };
  if (IRREG[w] || EXTRA[w]) return { base: IRREG[w] || EXTRA[w], sure: true };
  if (VERBS.has(w)) return { base: w, sure: true };
  const cvc = s => /^[^aeiouy]*[aeiou][^aeiouwxy]$/.test(s); // one-syllable "tap": its -ed form would double, so "taped" is tape
  const dbl = s => /([^aeioulsfz])\1$/.test(s) ? s.slice(0, -1) : null; // "stopp" → stop, but "fill" stays
  let cands = [], guess = null;
  if (/ed$/.test(w)) {
    const s = w.slice(0, -2);
    cands = [w.slice(0, -1), /ied$/.test(w) ? w.slice(0, -3) + 'y' : null, dbl(s), cvc(s) ? null : s];
    guess = dbl(s) || (cvc(s) || /([cgvuz]|[bcdfgkpstz]l|th|at)$/.test(s) ? s + 'e' : s);
  } else if (/ing$/.test(w)) {
    const s = w.slice(0, -3);
    cands = [/ying$/.test(w) ? s.slice(0, -1) + 'ie' : null, s + 'e', dbl(s), cvc(s) ? null : s];
    guess = dbl(s) || (cvc(s) || /([cgvuz]|[bcdfgkpstz]l|th|at)$/.test(s) ? s + 'e' : s);
  } else if (/s$/.test(w)) {
    cands = [w.slice(0, -1), /es$/.test(w) ? w.slice(0, -2) : null, /ies$/.test(w) ? w.slice(0, -3) + 'y' : null];
    guess = /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(s|x|z|ch|sh)es$/.test(w) ? w.slice(0, -2) : w.slice(0, -1);
  } else return { base: w, sure: true }; // no ending: already a base form
  const hit = cands.find(c => c && VERBS.has(c));
  return hit ? { base: hit, sure: true } : { base: guess, sure: false };
}

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

// 어휘 전처리 helpers, shared by 어휘 (문장·문단 빈칸) and 수업용 자료 (예문장·예문장 빈칸). "(e)xplored" keeps the hint letter.
function blankWords(text) {
  return text.trim().split(/\s+/).map(w => {
    const m = w.match(/^\((.+?)\)(.*)$/);
    return m ? esc(m[1]) + line_(m[2].length) : line_(w.length);
  }).join(' ');
}
const plain = s => s.replace(/^\s*\+/, '').replace(/\((.+?)\)/g, '$1').trim();

// 문장 빈칸: sentences with a blank, numbered per 본문; '[+...]' joins the previous blank in the same sentence.
function sentenceBlanks(secs, q, a) {
  for (const s of secs) {
    const sents = s.paras.flat().filter(hasBlank);
    if (!sents.length) continue;
    let n = 0; // numbering restarts in each 본문
    title(q, s.title); title(a, s.title);
    for (const st of sents) {
      const answers = []; // [number, [bodies]]
      const html = esc(st.en).replace(BRACKET, (_, b) => {
        const body = b.trim().replace(/^\+/, '');
        if (b.trim().startsWith('+') && answers.length) { answers[answers.length - 1][1].push(body); return blankWords(body); }
        answers.push([++n, [body]]);
        return `${supNum(n)}${blankWords(body)}`;
      });
      q.push(`<p style="${P}">${html}</p>`);
      q.push(`<p style="${KO}text-align:right;">${esc(st.ko)}</p>`);
      for (const [k, bodies] of answers) a.push(`<p style="${P}">${k}) ${esc(bodies.join(' / '))}</p>`);
    }
  }
}

// Self-written 어휘 전처리 example (the site is public, so no textbook passages here).
const VOCAB_EXAMPLE = `본문 1
Last summer, Mina [visited] an aquarium with her family and was [amazed by] the [colorful] fish. She [realized] that not only [is] the ocean [+full of] life, but it also needs [protection] from the people who visit it. Her brother took many pictures there.
지난여름 미나는 가족과 함께 수족관을 방문했고 형형색색의 물고기에 놀랐다. 그녀는 바다가 생명으로 가득할 뿐만 아니라 그곳을 찾는 사람들로부터 보호받아야 한다는 것을 깨달았다. 그녀의 남동생은 그곳에서 사진을 많이 찍었다.`;

// A note is plain text, or { key, text, off } shown as a checkbox (ticked = auto-processed).
const noteHtml = n => typeof n === 'string' ? esc(n) :
  `<label><input type="checkbox" data-key="${esc(n.key)}"${n.off ? '' : ' checked'}> ${n.off && n.strike !== false ? `<s>${esc(n.text)}</s>` : esc(n.text)}</label>`;

// Browser only: hooks up radios, textarea, example button and copy buttons for one tool page.
// example: one text, or { mode: text } when each mode needs its own 전처리 — then the input is also kept per mode.
// onToggle(key, ticked) is called when a note checkbox changes; the page then re-renders.
// inputStore: another page's key to share its saved input with (수업용 자료 uses the 어휘 input).
function setupPage(build, example, storeKey, onToggle, inputStore = storeKey) {
  const $ = id => document.getElementById(id);
  const mode = () => document.querySelector('input[name=mode]:checked').value;
  const store = (k, v) => { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); } catch (e) {} return v; };
  const perMode = typeof example === 'object';
  const inputKey = () => inputStore + (perMode ? '-' + mode() : '') + '-input';
  // Edited in another open tab (어휘 ↔ 수업용 자료): take it over here too.
  addEventListener('storage', e => { if (e.key === inputKey() && e.newValue !== null && e.newValue !== $('input').value) { $('input').value = e.newValue; render(); } });

  function render() {
    const text = $('input').value;
    const r = build(mode(), text);
    $('outQ').innerHTML = r.q; $('outA').innerHTML = r.a;
    const titles = (r.titles || parse(text).map(s => s.title)).filter(Boolean); // r.titles: page with its own input format
    $('warnings').innerHTML = (titles.length ? `<p class="note"><b>찾은 본문 ${titles.length}개</b>: ${titles.map(esc).join(' · ')}</p>` : '') +
      (r.titles ? [] : warnings(text)).concat(r.warns || []).map(w => `<p class="warn">${esc(w)}</p>`).join('') +
      (r.notes && r.notes.length ? `<p class="note"><b>${r.notesTitle}</b>${r.notesHint || (r.notes.some(n => typeof n !== 'string') ? ' — 체크를 풀면 그 단어는 원래대로 둡니다.' : '')}<br>${r.notes.map(noteHtml).join('<br>')}</p>` : '') +
      (r.html || '');
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
  return render; // for pages that change their output from outside (수업용 자료: AI 뜻 채우기)
}
