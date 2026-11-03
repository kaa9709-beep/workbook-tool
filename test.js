// Self-check for 어휘/어법/영작.html logic. Run: node test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const common = fs.readFileSync(__dirname + '/common.js', 'utf8');
// Loads common.js + one tool page's inline script into a fresh context, like the browser does.
function load(file, extra = '') {
  const html = fs.readFileSync(__dirname + '/' + file, 'utf8');
  const ctx = {};
  vm.runInNewContext(common + html.match(/<script>([\s\S]*)<\/script>/)[1] + ';this.build=build;this.warnings=warnings;' + extra, ctx);
  return ctx;
}
const vocabTool = load('어휘.html', 'this.stem=stem;this.supNum=supNum;this.parse=parse;this.setMyForms=setMyForms;this.RELEASED=RELEASED;this.EXAMPLE=EXAMPLE;'), grammarTool = load('어법.html', 'this.baseOf=baseOf;this.EXAMPLE=EXAMPLE;'), writeTool = load('영작.html', 'this.shuffle=shuffle;this.units=units;this.EXAMPLE=EXAMPLE;');
const text = h => h.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();

const vocab = `# 본문 1
When most people [were fascinated by] [exploring] space, and [eagerly] explored the deep ocean.
= 해석1
Not only [is] the ocean [+full of] life.
= 해석2
No blanks here.
= 해석3

Second paragraph [here], a fascinating idea.

# 본문 2
They explored it.`;

// 문장 빈칸: numbering, auto first-letter blanks for repeats within one 본문, blank-free sentences dropped
let r = vocabTool.build('sentence', vocab);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) were fascinated by', '2) exploring', '3) eagerly', '4) (e)xplored', '5) is / full of', '6) here', '7) (f)ascinating']);
assert(r.q.includes('⁴⁾e___________'), 'hint letter kept, rest blanked');
assert.strictEqual(vocabTool.supNum(12), '¹²⁾');
assert(!r.q.includes('No blanks here') && !r.q.includes('fascinated'), 'answers hidden, blank-free sentence dropped');
assert(!r.q.includes('They'), 'repeats are not carried into the next 본문');
assert.deepStrictEqual([...r.notes.map(n => n.text)], ['본문 1: explored ← exploring', '본문 1: fascinating ← fascinated']);

// Unticking a repeat leaves that word alone (outside [ ] it is no longer a blank); the note stays, marked off
vocabTool.RELEASED.add('본문 1|explored');
r = vocabTool.build('sentence', vocab);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) were fascinated by', '2) exploring', '3) eagerly', '4) is / full of', '5) here', '6) (f)ascinating']);
assert(r.q.includes('explored the deep') && r.notes[0].off === true && r.notes[1].off === false);
vocabTool.RELEASED.clear();
r = vocabTool.build('sentence', 'A [hard] task. It is hard, so hard.');
assert.deepStrictEqual([...r.notes.map(n => n.text)], ['본문: hard ← hard (2번)'], 'one note per word, with a count');
assert.deepStrictEqual(['explore', 'exploring', 'explored'].map(vocabTool.stem), ['explor', 'explor', 'explor']);
assert.strictEqual(vocabTool.stem('eagerly'), vocabTool.stem('eager'));

// 문단 빈칸: two copies (with / without 해석), paragraph answer
r = vocabTool.build('paragraph', vocab);
assert.strictEqual((r.q.match(/본문 1/g) || []).length, 2);
assert.strictEqual((r.q.match(/해석1/g) || []).length, 1);
assert(r.q.includes('No blanks here') && !r.q.includes('eagerly'));
assert(r.a.includes('<b><u>【explored】</u></b>') && r.a.includes('<b><u>【full of】</u></b>'), 'answers marked with 【 】: 한글 drops bold/underline');

// 동사 지도
r = grammarTool.build('verb', '# 본문 1\nPeople [fascinate = were fascinated] by [protect = to be protected 또는 protection].');
assert(r.q.includes('➊\u202F<b>(\u202Ffascinate\u202F)</b>') && r.q.includes('➋\u202F<b>(\u202Fprotect\u202F)</b>') && !r.q.includes('were fascinated'));
assert(!r.q.includes('<table'), 'no answer table: 한글 breaks it on paste');
assert(!r.q.includes('<div'), 'no box around the passage: 한글 drops it on paste');
const g2 = grammarTool.build('verb', '14-E\nShe [explore = explored] it. It [be = is] big.\n그녀는 그것을 탐험했다. 그것은 크다.');
assert(g2.q.startsWith('<p style="margin:14pt') && g2.q.includes('14-E') && !g2.q.includes('탐험'), 'new title style, 해석 left out');
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '➊ were fascinated', '➋ to be protected 또는 protection']);

// 어휘 example: natural format, 3 sentences paired with 3 해석, no warnings
assert.strictEqual(vocabTool.warnings(vocabTool.EXAMPLE).length, 0);
r = vocabTool.build('sentence', vocabTool.EXAMPLE);
assert(!r.q.includes('남동생') && !r.q.includes('pictures'), 'blank-free 3rd sentence dropped with its 해석');
assert.deepStrictEqual([...r.notes.map(n => n.text)], ['본문 1: visit ← visited'], 'example shows the repeat check');

// The page's own example uses the answer-only style and needs no warnings
r = grammarTool.build('verb', grammarTool.EXAMPLE.verb);
assert(!grammarTool.EXAMPLE.verb.includes(' = ') && r.warns.length === 0 && r.q.includes('➌\u202F<b>(\u202Fswim\u202F)</b>') && r.q.includes('➏\u202F<b>(\u202Fuse\u202F)</b>'));

// 동사 지도, answer only: the base form is made automatically.
// Pairs from the finished sample (3. …_동사 지도.hwpx); its three slips (breath, made, allows) are given correctly here.
const base = a => grammarTool.baseOf(a).base;
const pairs = `were fascinated=fascinate; exploring=explore; explored=explore; to be=be; is=be; to be protected (또는 protection)=protect; named=name;
was born=bear; Having moved=Move; exploring 또는 to explore=explore; gifted=gift; saying=say; dive 또는 to dive=dive; descending=descend; wearing=wear;
belonged=belong; was thrilled=thrill; breathing=breathe; to use=use; leading=lead; to become=become; to live=live; situated=situate; living=live;
following=follow; having been chosen=choose; challenged=challenge; to observe=observe; understand 또는 to understand=understand; were published=publish;
return=return; receiving=receive; Using=Use; walked=walk; earned=earn; was charmed=charm; glowing=glow; were=be; had studied=study; emits=emit; noted=note;
to know=know; respect 또는 to respect=respect; was appointed=appoint; to shift=shift; exploiting=exploit; prioritizing=prioritize; faced=face; Returning=Return;
to campaign=campaign; made=make; allows=allow; is covered=cover; are=be; learning=learn; interesting=interest; find out=find;
stopped=stop; taped=tape; hoping=hope; hopping=hop; filled=fill; dying=die; tied=tie; agreed=agree; passes=pass; uses=use; goes=go; watches=watch`.split(';');
for (const p of pairs) { const [ans, want] = p.split('=').map(x => x.trim()); assert.strictEqual(base(ans), want, ans); }
assert.strictEqual(grammarTool.baseOf('unattached').sure, false, 'not in the verb list: flagged');
assert.deepStrictEqual([...grammarTool.baseOf('found').alts], ['find', 'found']);

r = grammarTool.build('verb', '본문 1\nTwo-thirds of our planet [is covered] by oceans. They [are] home to millions. We are [learning] new things, and it was [unattached] and [found].');
assert(r.q.includes('➊\u202F<b>(\u202Fcover\u202F)</b>') && r.q.includes('➋\u202F<b>(\u202Fbe\u202F)</b>') && r.q.includes('➌\u202F<b>(\u202Flearn\u202F)</b>'));
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '➊ is covered', '➋ are', '➌ learning', '➍ unattached', '➎ found']);
assert.deepStrictEqual([...r.notes], ['본문 1: is covered → cover · are → be · learning → learn · unattached → unattach · found → find']);
assert.strictEqual(r.warns.length, 2);
assert(r.warns[0].includes('➍ unattached → (unattach)') && r.warns[1].includes('find, found'));

// 어법 선택형: * marks right options, order kept, "(N 다 체크해야 함)", numbering per 본문
r = grammarTool.build('choice', `본문 1
They [fascinated/*were fascinated] it. No brackets here. The life [what/*that/*which] I see.
그들은 매료되었다. 괄호 없음. 내가 보는 생명.

본문 2
It [*a/*b/*c/d] was.`);
assert.deepStrictEqual(text(r.q).split('\n'), ['본문 1', 'They ¹⁾[\u202Ffascinated\u202F/\u202Fwere fascinated\u202F] it.', '그들은 매료되었다.',
  'The life ²⁾[\u202Fwhat\u202F/\u202Fthat\u202F/\u202Fwhich\u202F] I see.', '내가 보는 생명.', '본문 2', 'It ¹⁾[\u202Fa\u202F/\u202Fb\u202F/\u202Fc\u202F/\u202Fd\u202F] was.']);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) were fascinated', '2) that 또는 which (둘 다 체크해야 함)', '본문 2', '1) a 또는 b 또는 c (셋 다 체크해야 함)']);
assert.strictEqual(r.warns.length, 0);

// Warnings, including the two slips found in the finished sample (4. …_어법 선택형.hwpx)
r = grammarTool.build('choice', '본문 1\nA [choosing/*having been chosen/having been chosen] b [prevents/*preventingprevented] c [*x] d [a/b] e [*p//q] f [*m/*n].');
const w = r.warns.join('\n');
assert(w.includes('1번') && w.includes('"having been chosen"가 두 번'), 'duplicate option');
assert(!/2번/.test(w), 'a missing / cannot be detected; it shows in the preview instead');
assert(w.includes('3번 [*x]: 선택지가 하나뿐') && w.includes('4번 [a/b]: 정답 표시(*)가 없어요') && w.includes('5번 [*p//q]: 빈 선택지') && w.includes('6번 [*m/*n]: 모든 선택지'));
assert(text(r.a).includes('4) (정답 표시 없음)'));

// A ? or . inside quotes does not end the sentence (English and 해석 both)
r = grammarTool.build('choice', grammarTool.EXAMPLE.choice);
assert.strictEqual(r.warns.length, 0, 'example: no warnings, 해석 paired');
assert(text(r.q).includes('“Not all of them. Some were born here, in the tank ⁴⁾[\u202Fwhich\u202F/\u202Fthat\u202F/\u202Fwhat\u202F] you see.”'));
assert(text(r.q).includes('그는 “전부는 아니에요. 몇몇은 여기'));
assert(text(r.a).includes('4) which 또는 that (둘 다 체크해야 함)'));

// 어법 고치기: problem with wrong forms and "(N개)", answer with corrections in red bold
r = grammarTool.build('fix', grammarTool.EXAMPLE.fix);
assert.strictEqual(r.warns.length, 0);
assert(r.q.includes('본문 1 (4개)') && r.q.includes('Mina visit an aquarium') && r.q.includes('animals are endangering by') && !r.q.includes('['));
assert(r.a.includes('>본문 1<') && !r.a.includes('4개') && r.a.includes('Mina <b style="color:#FF0000;">【visited】</b> an'));
assert.strictEqual((text(r.a).match(/【[^】]+】/g) || []).length, 4, 'corrections stay visible as plain text: 한글 drops bold/colour');
assert.strictEqual((r.a.match(/color:#FF0000/g) || []).length, 4);

r = grammarTool.build('fix', `본문 2
It was fun to watch fish while [to breathe = breathing 또는 she breathed] naturally. We can [to work = work] hard.

Second [paragraph = paragraphs] here, [a] and [b = b] and [in = ] .
번역 줄은 무시된다.`);
assert(r.q.includes('본문 2 (6개)') && !r.q.includes('번역'));
assert.strictEqual((r.q.match(/<p style="margin:0 0 6pt/g) || []).length, 2, 'paragraphs kept');
assert(r.a.includes('<b style="color:#FF0000;">【breathing (또는 she breathed)】</b> naturally'));
assert(r.q.includes('and in.') && r.a.includes('and <b style="color:#FF0000;">【삭제: in】</b>.'), 'deletion: written out, a strike-through would be lost in 한글');
assert(r.warns.length === 2 && r.warns[0].includes('4번째 [a]: = 가 없어요') && r.warns[1].includes('5번째 [b = b]: 틀린 표현과 고친 표현이 같아요'));

// 배열 영작 / 통영작
const write = `# 본문 1
When [most people were fascinated] by it, and [eagerly explored it 또는 explored it eagerly].
= 해석A
She is [the / named / Sylvia Earle].
= 해석B`;
r = writeTool.build('arrange', write);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) most people were fascinated / eagerly explored it 또는 explored it eagerly', '2) the named Sylvia Earle']);
assert(r.q.includes('Sylvia Earle') && !r.q.includes('또는'), 'chunk kept together, alternatives hidden');
assert(r.q.indexOf('1) 해석A') < r.q.indexOf('When'), '해석 comes before the English');
r = writeTool.build('full', write);
assert(!/fascinated|Sylvia/.test(r.q) && r.q.includes('2) 해석B'));
assert.strictEqual((r.q.match(/_{3,}/g) || []).length, 4 + 3 + 4, 'one blank per word');
assert(!r.q.includes('<div') && !r.q.includes('<b>'), 'no box, no bold: 한글 drops both');

// {chunk} stays together; numbering restarts in each 본문; answers without braces
assert.deepStrictEqual([...writeTool.units('not {only is} the ocean {full of} life')], ['not', 'only is', 'the', 'ocean', 'full of', 'life']);
r = writeTool.build('arrange', writeTool.EXAMPLE + '\n\n본문 2\nIt is [a {b c} d].\n그것.');
assert.strictEqual(r.warns.length, 0);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) Mina visited an aquarium with her family',
  '2) the ocean is full of life / to use less plastic 또는 that she would use less plastic', '3) the sea animals swimming in the tank', '본문 2', '1) a b c d']);
assert(/[[/] full of [/\]]/.test(r.q) && /[[/] sea animals [/\]]/.test(r.q) && /[[/] swimming in [/\]]/.test(r.q) && !r.q.includes('{'), 'chunks shown whole, braces hidden');
r = writeTool.build('full', writeTool.EXAMPLE);
assert(!r.q.includes('aquarium') && !r.q.includes('{'), 'every word blanked, braces hidden');
assert.strictEqual(writeTool.build('arrange', '본문 1\nA [b {c d].\n해석.').warns.length, 1, 'unbalanced braces warned');

// shuffle: deterministic and never the original order
const u = ['a', 'b'];
assert.deepStrictEqual(writeTool.shuffle(u, 'x'), writeTool.shuffle(u, 'x'));
for (const seed of ['a', 'b', 'c', 'd', 'e']) assert.notDeepStrictEqual(writeTool.shuffle(u, seed), u);

assert.strictEqual(vocabTool.warnings('ok [a]\nbad [a').length, 1);

// Natural format: "본문 N" title, paragraph on one line, 해석 paragraph below without "="
const natural = `본문 1
Mr. Kim lives in the U.S. and is [covered] by it. They [are full of] wonder! Let's [find out] more.
김 씨는 미국에 산다. 그들은 경이로 가득하다. 더 알아보자.

본문 2
One [two]. Three [four].
하나 둘 셋 넷.`;
r = vocabTool.build('sentence', natural);
assert.deepStrictEqual(text(r.q).split('\n'), ['본문 1',
  'Mr. Kim lives in the U.S. and is ¹⁾___________ by it.', '김 씨는 미국에 산다.',
  'They ²⁾_____ ______ ___ wonder!', '그들은 경이로 가득하다.',
  'Let\'s ³⁾______ _____ more.', '더 알아보자.',
  '본문 2', 'One ¹⁾_____. Three ²⁾______.', '하나 둘 셋 넷.'], 'numbering restarts in each 본문');
assert.deepStrictEqual([...vocabTool.warnings(natural)], ['7번째 줄: 영어 2문장, 해석 1문장이라 짝을 못 지었어요. 한 덩어리로 묶어 두었으니 이 부분만 직접 줄을 나눠 주세요.']);
r = vocabTool.build('paragraph', natural);
assert(!r.a.includes('김 씨는') && (r.q.match(/김 씨는/g) || []).length === 1, '해석 is not mixed into the English');

// Other title styles, short 해석 without a period, 해석 after a blank line, several 본문 in one input
const titled = `14-E
They [went] out.
나갔다

15-2
They went out. Go [now].

지금 가라는 말이다. 가라.
프린트 1번
[Children] and a child.
아이들.`;
const secs = vocabTool.parse(titled);
assert.deepStrictEqual([...secs.map(s => s.title)], ['14-E', '15-2', '프린트 1번']);
assert.strictEqual(secs[0].paras[0][0].ko, '나갔다');
assert.deepStrictEqual([...secs[1].paras.flat().map(s => s.ko)], ['지금 가라는 말이다.', '가라.']);
r = vocabTool.build('sentence', titled);
assert.deepStrictEqual([...r.notes.map(n => n.text)], ['프린트 1번: child ← Children'], 'went in 15-2 is not a repeat of 14-E');

// Irregular forms join their base; look-alikes stay apart
const same = (a, b) => vocabTool.stem(a) === vocabTool.stem(b);
for (const [a, b] of [['go', 'went'], ['bring', 'brought'], ['write', 'written'], ['writes', 'wrote'], ['child', 'children'], ['tooth', 'teeth'], ['good', 'better']]) assert(same(a, b), `${a} = ${b}`);
for (const [a, b] of [['new', 'news'], ['even', 'evening'], ['even', 'evenings'], ['hard', 'hardly'], ['late', 'lately']]) assert(!same(a, b), `${a} ≠ ${b}`);
assert(same('evening', 'evenings'));

// User's own forms: added on top of the built-in list, and can override it
vocabTool.setMyForms('leave: left, leaving\nhard hardly\n\n');
assert(same('leave', 'left') && same('leave', 'leaving') && same('hard', 'hardly') && same('go', 'went'));
vocabTool.setMyForms('');
assert(!same('leave', 'left') && !same('hard', 'hardly'));
console.log('all checks passed');

// 씨드: PDF line breaks joined, 번호 O with 반 칸, ambiguous ? ! quote boundaries, pairing with 해석
const seedTool = load('씨드.html', 'this.EXAMPLE=EXAMPLE;this.onToggle=onToggle;this.OVR=OVR;this.isSeedTitle=isSeedTitle;');
const seedIn = `■ 14-E
Old offices were built around
functions and well-
known rules. Is that enough? No! The
change has started—
quickly. "Stop. Wait," he said.
낡은 사무실은 기능과 잘 알려진
규칙을 중심으로 지어졌다. 그것으로 충분할까? 아니다! 변화는
이미 빠르게 시작되었다. "멈춰. 기다려."라고 그가 말했다.`;
const lines = h => text(h).replace(/&quot;/g, '"').split('\n');
r = seedTool.build('plain', seedIn);
assert.deepStrictEqual(lines(r.q), ['14-E',
  'Old offices were built around functions and well-known rules. Is that enough? No! The change has started—quickly. "Stop. Wait," he said.',
  '낡은 사무실은 기능과 잘 알려진 규칙을 중심으로 지어졌다. 그것으로 충분할까? 아니다! 변화는 이미 빠르게 시작되었다. "멈춰. 기다려."라고 그가 말했다.']);
assert.deepStrictEqual([...r.titles], ['14-E']);
assert.deepStrictEqual([...r.warns], [], 'English 5 = 해석 5');
// ? and ! split by default but are listed; the period inside quotes is listed and not split
assert.deepStrictEqual([...r.notes].map(n => [n.text.split(': ')[1].replace(' → 한 문장으로 묶음', ''), n.off]), [
  ['…rules. Is that enough? ∣ No! The…', false], ['…Is that enough? No! ∣ The change…', false],
  ['…change has started—quickly. "Stop. ∣ Wait," he…', true], ['…이미 빠르게 시작되었다. "멈춰. ∣ 기다려."라고 그가…', true]]);
r = seedTool.build('num', seedIn);
assert.strictEqual(lines(r.q)[1], '➊ Old offices were built around functions and well-known rules. ➋ Is that enough? ➌ No! ➍ The change has started—quickly. ➎ "Stop. Wait," he said.');
assert(lines(r.q)[2].startsWith('➊ 낡은') && lines(r.q)[2].includes('➎ "멈춰.'));

// Unticking "No!" joins two sentences; 해석 then has one more → warning + pair table; joining the 해석 too fixes it
const noKey = r.notes[1].key;
seedTool.onToggle(noKey, false);
r = seedTool.build('line', seedIn);
assert(r.warns[0].includes('영어 4문장, 해석 5문장') && r.html.includes('다음 문장과 합치기'));
const koKey = r.html.match(/data-key="join\|([^"]*아니다!\|변화는)"/)[1].replace(/&quot;/g, '"');
seedTool.onToggle('join|' + koKey, true);
r = seedTool.build('line', seedIn);
assert.deepStrictEqual([...r.warns], []);
assert.deepStrictEqual(lines(r.q).slice(5, 7), ['No! The change has started—quickly.', '아니다! 변화는 이미 빠르게 시작되었다.'], '한 줄 씨드 follows the same split');
assert(r.notes.some(n => n.key === koKey && n.off), 'a manual join stays listed so it can be undone');
seedTool.onToggle(noKey, true); seedTool.onToggle(koKey, true);
assert.deepStrictEqual({ ...seedTool.OVR }, {}, 'back to default = nothing saved');

// Titles: ■ lines, or a label alone on its line (본문 1, 프린트 5번, 14-E, 17-2); wrapped PDF lines and a # in a passage are not titles
assert(['■ 본문 1', '■14-E', '■ Into a New World', '본문 1', '본문7', '프린트 5번', '14-E', '17-2', 'Lesson 3'].every(seedTool.isSeedTitle));
assert(!['structures', 'Iron Man 2', '#1', '# 본문 2', 'in 12', 'in 1969', 'Earle in 1979', '1935년 뉴저지에서', '많은', 'Into a New World', '2009'].some(seedTool.isSeedTitle));
r = seedTool.build('num', '14-E\nIt is.\n그렇다.\n프린트 1번\nIt was.\n그랬다.');
assert.deepStrictEqual(lines(r.q).map(l => l.replace(/ /g, ' ')), ['14-E', '➊ It is.', '➊ 그렇다.', '프린트 1번', '➊ It was.', '➊ 그랬다.']);
// More than 20 sentences: warned, (21) after ⓴
r = seedTool.build('num', '■ 본문 9\n' + Array.from({ length: 21 }, (_, i) => `Line ${i + 1} ends.`).join(' ') + '\n해석.');
assert(r.q.includes('⓴ Line 20') && r.q.includes('(21) Line 21') && r.warns.some(w => w.includes('21번부터')));
// 한글 wrapped mid-word has no trailing space ("전⏎체적" → 전체적), between words it does; * lines are footnotes
const wrapIn = '■ 본문 2\nA change in the \nfood supply is a catastrophe. \nIt hurts.\n* catastrophe: 재앙  **supply: 공급\n' +
  '식량 공급의 변화는 전\n체적인 재앙이다. 그것은 \n아프게 한다.';
r = seedTool.build('plain', wrapIn);
assert.deepStrictEqual(lines(r.q), ['본문 2', 'A change in the food supply is a catastrophe. It hurts.',
  '* catastrophe: 재앙 **supply: 공급', '식량 공급의 변화는 전체적인 재앙이다. 그것은 아프게 한다.']);
assert.deepStrictEqual([...r.warns], []);
assert.strictEqual(lines(seedTool.build('num', wrapIn).q)[2], '* catastrophe: 재앙 **supply: 공급');
r = seedTool.build('line', wrapIn);
assert.deepStrictEqual(lines(r.q), ['본문 2', 'A change in the food supply is a catastrophe.', '식량 공급의 변화는 전체적인 재앙이다.',
  'It hurts.', '그것은 아프게 한다.'], '한 줄 씨드 drops footnotes');
assert.strictEqual((r.q.match(/<p /g) || []).length - 1, 2, '한 줄 씨드: one paragraph per English + 해석 pair');
// No trailing spaces anywhere (other PDF viewers): 한글 line breaks stay spaces, as before
assert(lines(seedTool.build('plain', '■ 3\nIt is.\n잘 알려진\n규칙이다.').q)[2] === '잘 알려진 규칙이다.');
// Page example: no warnings
assert.deepStrictEqual([...seedTool.build("num", seedTool.EXAMPLE).warns], []);
// 한글 파일 rows: 상하씨드 = title, English, notes, 해석, an empty line between passages; 한 줄 씨드 = pairs with an empty line after each
const rowsOf = (mode, t) => JSON.stringify(seedTool.build(mode, t).rows.map(x => x.k + ':' + x.t));
assert.strictEqual(rowsOf('plain', wrapIn + '\n■ 3\nIt is.\n그렇다.'), JSON.stringify(['title:본문 2', 'en:A change in the food supply is a catastrophe. It hurts.',
  'note:* catastrophe: 재앙 **supply: 공급', 'ko:식량 공급의 변화는 전체적인 재앙이다. 그것은 아프게 한다.', 'gap:', 'title:3', 'en:It is.', 'ko:그렇다.']));
assert.strictEqual(rowsOf('line', wrapIn), JSON.stringify(['title:본문 2', 'en:A change in the food supply is a catastrophe.', 'ko:식량 공급의 변화는 전체적인 재앙이다.', 'gap:',
  'en:It hurts.', 'ko:그것은 아프게 한다.']));
{ // the file itself (seedfile.js, no template): margins, fonts, sizes, line spacing, one paragraph per row
  const S = { TextDecoder, TextEncoder };
  vm.runInNewContext(fs.readFileSync(__dirname + '/hwpx.js', 'utf8') + fs.readFileSync(__dirname + '/seedfile.js', 'utf8') + ';this.seedFile=seedFile;this.unzip=unzip;', S);
  const rows = seedTool.build('num', seedTool.EXAMPLE).rows, bytes = S.seedFile(rows);
  S.unzip(bytes, async d => d).then(f => {
    const dec = b => new TextDecoder().decode(b), sec = dec(f['Contents/section0.xml']), head = dec(f['Contents/header.xml']);
    assert.strictEqual(dec(f.mimetype), 'application/hwp+zip');
    assert(/<hp:margin header="4252" footer="4252" gutter="0" left="4252" right="4252" top="2835" bottom="2835"\/>/.test(sec), 'margins 15 / 10 mm');
    assert(/face="Pretendard"/.test(head) && /face="Pretendard Medium"/.test(head), 'fonts');
    assert(/<hh:charPr id="0" height="1000"[^>]*>.*?hangul="0"/.test(head) && /<hh:charPr id="2" height="800"[^>]*>.*?hangul="1"/.test(head), '10 pt / Medium 8 pt');
    assert(/<hh:paraPr id="0"[\s\S]*?value="225"[\s\S]*?<hh:paraPr id="1"[\s\S]*?value="160"/.test(head), '225 % / 160 %');
    assert.strictEqual(sec.split('<hp:p ').length - 1, rows.length, 'one paragraph per row');
    assert(sec.includes('<hp:t>본문 1</hp:t>') && sec.includes('➊ Last summer'), 'text (반 칸 after the number)');
    assert(/paraPrIDRef="1" styleIDRef="0"[^>]*><hp:run charPrIDRef="2"><hp:t>➊ 지난여름/.test(sec), '해석 look');
    console.log('씨드 파일 checks passed');
  }).catch(e => { console.error(e); process.exit(1); });
}
console.log('씨드 checks passed');

// 수업용 자료: 예문장 (원형 list + 【 】) and 예문장 빈칸 (문장 빈칸 without the repeat hints), from the same 어휘 전처리
const classTool = load('수업.html', 'this.entry=entry;this.EXAMPLE=EXAMPLE;this.MEAN=MEAN;');
const classIn = `본문 1
[Exploring] the sea, she [was fascinated by] fish and [committed herself to] [protecting] it, so she explored more.
바다를 탐험하며 그녀는 물고기에 매료되었고 그것을 지키는 데 전념해서 더 탐험했다.
Not only [is] the ocean [+full of] life, but it [belongs to] us, and [global warming] and [fossil fuels] [serve as] [threats] to the [endangered] [species].
바다는 생명으로 가득할 뿐 아니라 우리의 것이며, 지구 온난화와 화석 연료는 멸종 위기 종에 위협이 된다.`;
r = classTool.build('example', classIn);
assert.deepStrictEqual(lines(r.q), ['본문 1',
  'explore:', 'be fascinated by ~:', 'commit oneself to ~:', 'protect:',
  '【Exploring】 the sea, she 【was fascinated by】 fish and 【committed herself to】 【protecting】 it, so she explored more.',
  '바다를 탐험하며 그녀는 물고기에 매료되었고 그것을 지키는 데 전념해서 더 탐험했다.',
  'be full of ~:', 'belong to ~:', 'global warming:', 'fossil fuel:', 'serve as ~:', 'threat:', 'endangered:', 'species:',
  'Not only 【is】 the ocean 【full of】 life, but it 【belongs to】 us, and 【global warming】 and 【fossil fuels】 【serve as】 【threats】 to the 【endangered】 【species】.',
  '바다는 생명으로 가득할 뿐 아니라 우리의 것이며, 지구 온난화와 화석 연료는 멸종 위기 종에 위협이 된다.']);
assert.strictEqual((r.q.match(/<p /g) || []).length, 3, 'title + one paragraph per sentence, so 한글 adds no empty lines inside it');
assert.strictEqual(r.a, '');
assert.strictEqual(r.fill.length, 12, 'every listed word goes to AI 뜻 채우기, with its sentence');
classTool.MEAN[r.fill[0].word + '\n' + r.fill[0].en] = 'v. 탐험하다';
assert(classTool.build('example', classIn).q.includes('explore: v. 탐험하다<br>be fascinated by ~:<br>'), 'filled 뜻 after the 원형, others stay empty');
// 예문장 빈칸: "explored" is not caught (that is what 문장 빈칸 does)
r = classTool.build('exblank', classIn);
assert.deepStrictEqual(text(r.a).split('\n'), ['본문 1', '1) Exploring', '2) was fascinated by', '3) committed herself to', '4) protecting',
  '5) is / full of', '6) belongs to', '7) global warming', '8) fossil fuels', '9) serve as', '10) threats', '11) endangered', '12) species']);
assert(r.q.includes('so she explored more.'));
assert(vocabTool.build('sentence', classIn).a.includes('(e)xplored'), '문장 빈칸 still catches it');
assert.strictEqual(classTool.entry(['found'], false).guesses.length, 1, 'two-meaning form is flagged');
assert.deepStrictEqual([...classTool.build('example', classTool.EXAMPLE).notes], []);
// 씨드 번호 O as 전처리: paired by ➊ numbers (not by counting sentences), numbers dropped, * notes skipped
const H = ' ';
const seedNum = `본문 1
➊${H}[Exploring] the sea, she [was fascinated by] fish and [committed herself to] [protecting] it, so she explored more. ➋${H}Not only [is] the ocean [+full of] life, but it [belongs to] us, and [global warming] and [fossil fuels] [serve as] [threats] to the [endangered] [species].
* fossil fuel: 화석 연료
➊${H}바다를 탐험하며 그녀는 물고기에 매료되었고 그것을 지키는 데 전념해서 더 탐험했다. ➋${H}바다는 생명으로 가득할 뿐 아니라 우리의 것이며, 지구 온난화와 화석 연료는 멸종 위기 종에 위협이 된다.`;
const [ct, ce1, ck1, ce2, ck2] = classIn.split('\n'), plainIn = [ct, ce1 + ' ' + ce2, ck1 + ' ' + ck2].join('\n'); // the same text as 번호 X: one English line, one 해석 line
for (const mode of ['example', 'exblank']) assert.strictEqual(classTool.build(mode, seedNum).q, classTool.build(mode, plainIn).q, mode + ': 번호 O = 번호 X');
assert.strictEqual(vocabTool.build('sentence', seedNum).a, vocabTool.build('sentence', plainIn).a);
assert.deepStrictEqual([...classTool.warnings(seedNum)], []);
// 4 English sentences, 6 해석 sentences (one English sentence translated as three): fine with numbers
const uneven = `본문 2
➊${H}A [b]. ➋${H}C [d]. ➌${H}E [f]. ➍${H}G [h].
➊${H}가. ➋${H}나. 다. 라. ➌${H}마. ➍${H}바.`;
assert.deepStrictEqual([...classTool.warnings(uneven)], []);
assert.deepStrictEqual(lines(classTool.build('example', uneven).q).filter(l => /[가-힣]\./.test(l)), ['가.', '나. 다. 라.', '마.', '바.']);
assert(classTool.warnings(uneven.replace(`➊${H}가. ➋${H}`, `➋${H}`)).some(w => w.includes('해석이 없는 번호 ➊')));
// English in two paragraphs, then the 해석 in two: still paired by number
const twoParas = `본문 3
➊${H}A [b]. ➋${H}C [d].
➌${H}E [f].
➊${H}가. ➋${H}나.
➌${H}마.`;
assert.deepStrictEqual(lines(classTool.build('example', twoParas).q).filter(l => /[가-힣]\./.test(l)), ['가.', '나.', '마.']);
console.log('수업용 자료 checks passed');

// 수업 자료 파일 (자료.html + hwpx.js): 씨드 → 한글 파일
const fileTool = {}, plain = x => JSON.parse(JSON.stringify(x)); // values from the vm context, as plain data
vm.runInNewContext(common + fs.readFileSync(__dirname + '/hwpx.js', 'utf8') + fs.readFileSync(__dirname + '/자료.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1]
  + ';Object.assign(out, { passages, warnings, setNum, lineCount, unzip, topParas, readTemplate, makeFile, pagePlan, LINE_GAP });', { out: fileTool, TextDecoder, TextEncoder });
const seed = `본문 1
➊ She dives. ➋ She swims.
* dive: 잠수하다
➊ 그녀는 잠수한다. ➋ 그녀는 수영한다.
본문 2
➊ Fish live here.
➊ 물고기가 여기 산다.`;
const sp = fileTool.passages(seed);
assert.deepStrictEqual(plain(sp.map(p => [p.title, p.en.flat().map(x => x.n + x.s), p.ko.flat().length, p.notes])),
  [['본문 1', ['➊She dives.', '➋She swims.'], 2, ['* dive: 잠수하다']], ['본문 2', ['➊Fish live here.'], 1, []]]);
assert.deepStrictEqual(plain(fileTool.warnings(fileTool.passages('본문 1\n➊ A. ➋ B.\n➊ 가.'))), ['본문 1: 해석에 없는 번호 ➋ — 한 줄 해석에서 해석이 비어요.']);
// '새 번호로 시작': one control, put in an empty run, stacked leftovers dropped, removed when empty
const blankP = '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="1"><hp:run charPrIDRef="1"/></hp:p>';
assert.strictEqual(fileTool.setNum(blankP, 12), '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="1"><hp:run charPrIDRef="1"><hp:ctrl><hp:newNum num="12" numType="PAGE"/></hp:ctrl></hp:run></hp:p>');
const stacked = '<hp:p><hp:run charPrIDRef="1"><hp:ctrl><hp:newNum num="37" numType="PAGE"/></hp:ctrl><hp:ctrl><hp:newNum num="47" numType="PAGE"/></hp:ctrl><hp:t/></hp:run></hp:p>';
assert.strictEqual((fileTool.setNum(stacked, 9).match(/newNum/g) || []).length, 1);
assert(fileTool.setNum(stacked, 9).includes('num="9"'));
assert(!fileTool.setNum(stacked, null).includes('newNum'));
// line wrapping: 페이퍼로지 10pt in the original's line width
const en10 = { font: '페이퍼로지 5 Medium', size: 1000, spacing: 0 };
assert.strictEqual(fileTool.lineCount('She is the legendary marine biologist named Sylvia Earle.', en10, 50324), 1);
assert.strictEqual(fileTool.lineCount('When most people were fascinated by the mysteries of exploring space, one remarkable individual appreciated the appeal of the ocean before many others, and eagerly explored the deep ocean.', en10, 50324), 3, '한글 made 3 lines of it');
assert.strictEqual(fileTool.LINE_GAP, 4);

// The whole file, from the finished 수업용 자료 on this computer (samples/ is not in git: textbook text).
const tplPath = __dirname + '/samples/3. 영어2_YBM_박준언_4과_수업용_자료.hwpx';
if (!fs.existsSync(tplPath)) console.log('수업 자료 파일: template not here, file checks skipped');
else (async () => {
  const zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  const files = await fileTool.unzip(fs.readFileSync(tplPath), inflate), T = fileTool.readTemplate(files);
  assert.deepStrictEqual(plain([T.academy, T.school, T.book.name, T.cover.text, T.nums.map(p => p && p.num)]),
    ['남양주 대치하이 영어학원', '다산고 2학년 2학기 중간고사 대비', '영어 2 (YBM 박준언)', '영어 2 (YBM 박준언) 4과', [31, null, 47, 48]]);
  // the original's own 본문 → only 본문 1 fits one page in 한 줄 해석 (the user added a blank page there by hand)
  const ps = fileTool.topParas(dec(files['Contents/section0.xml']));
  const t1 = ps.findIndex(p => p.text === '본문 1'), t2 = ps.findIndex((p, i) => i > t1 && p.text === '본문 1');
  const original = fileTool.passages(ps.slice(t1, t2).filter(p => p.text && !p.shape && !(/해석/.test(p.text) && p.text.length < 10)).map(p => p.text.replace(/\s+/g, ' ')).join('\n'));
  assert.deepStrictEqual(plain(fileTool.pagePlan(T, dec(files["Contents/header.xml"]), original).map(x => x.onePage)), [true, false, false, false, false, false, false]);

  const out = await fileTool.unzip(fileTool.makeFile(files, seed + '\n본문 3\n' + [...'➊➋➌➍➎➏➐➑➒➓⓫'].map(n => n + ' Hi.').join(' ') + '\n' + [...'➊➋➌➍➎➏➐➑➒➓⓫'].map(n => n + ' 안녕.').join(' '),
    { cover: '영어 독해와 작문 (천재 강상구) 3과', lesson: 'Lesson 9. Test', academy: '반포 센티움학원', book: '영어 독해와 작문 (천재 강상구)', school: '시험고 1학년 기말고사 대비', nums: [11, 12, 27, 28] }));
  assert.deepStrictEqual(Object.keys(out), Object.keys(files), 'same parts, same order');
  const sec = dec(out['Contents/section0.xml']), header = dec(out['Contents/header.xml']), masters = dec(out['Contents/masterpage0.xml']) + dec(out['Contents/masterpage1.xml']);
  assert.deepStrictEqual([...sec.matchAll(/<hp:newNum num="(\d+)"/g)].map(m => +m[1]), [11, 12, 27, 28]);
  assert.strictEqual((sec.match(/영어<hp:fwSpace\/>독해와<hp:fwSpace\/>작문/g) || []).length, 2, 'both covers');
  assert(!/대치하이|다산고|박준언/.test(masters) && masters.includes('<hp:t>반포 센티움학원 김진혁 영어') && masters.includes('시험고 1학년 기말고사 대비') && masters.includes('Lesson 9. Test'));
  const bookRun = masters.match(/<hp:run charPrIDRef="(\d+)"><hp:t>영어 독해와 작문 \(천재 강상구\)<\/hp:t>/);
  assert(bookRun && +header.match(new RegExp('<hh:charPr id="' + bookRun[1] + '" height="(\\d+)"'))[1] < 1200, '교재 이름 shrunk to one line');
  assert(/<hp:textMargin left="\d{3,}" right="\d{4,}"/.test(masters.slice(masters.indexOf(bookRun[0]))), 'old padding became box margins');
  // * 주석: '본문' style, right-aligned
  const noteP = sec.slice(sec.lastIndexOf('<hp:p ', sec.indexOf('* dive')), sec.indexOf('* dive'));
  const notePr = noteP.match(/paraPrIDRef="(\d+)" styleIDRef="(\d+)"/);
  assert(header.includes(`<hh:style id="${notePr[2]}" type="PARA" name="본문"`) && new RegExp('<hh:paraPr id="' + notePr[1] + '"[^>]*><hh:align horizontal="RIGHT"').test(header));
  // 한 줄 해석: 본문마다 its own 문단 번호, 10+ on a second one that starts at 10
  const lineIds = [...sec.matchAll(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>(?:(?!<\/hp:p>)[\s\S])*?<hp:lineBreak\/>/g)].map(m => m[1]);
  assert.deepStrictEqual(lineIds.map(id => id === lineIds[0] ? 'a' : id === lineIds[2] ? 'b' : id === lineIds[3] ? 'c' : id === lineIds[12] ? 'd' : id),
    ['a', 'a', 'b', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'd', 'd']);
  const numOf = id => header.match(new RegExp('<hh:paraPr id="' + id + '"[\\s\\S]*?idRef="(\\d+)" level="0"'))[1];
  const head = id => header.match(new RegExp('<hh:numbering id="' + numOf(id) + '"[^>]*><hh:paraHead start="(\\d+)"[^>]*>([^<]*)')).slice(1).join(' ');
  assert.deepStrictEqual([head(lineIds[0]), head(lineIds[3]), head(lineIds[12])], ['1 0^1.', '1 0^1.', '10 ^1.']);
  for (const [k, v] of [['numberings', 'numbering'], ['paraProperties', 'paraPr'], ['charProperties', 'charPr']])
    assert.strictEqual(+header.match(new RegExp('<hh:' + k + ' itemCnt="(\\d+)"'))[1], (header.match(new RegExp('<hh:' + v + ' id=', 'g')) || []).length, k + ' count');
  // Titles are not always "본문 N": a template with 14-1, 14-2, … and input titled 14-E / 프린트 1번
  const renamed = Object.assign({}, files);
  const sec0 = dec(files['Contents/section0.xml']), sec14 = sec0.replace(/<hp:t>본문(?: |<hp:fwSpace\/>)(\d+)<\/hp:t>/g, '<hp:t>14-$1</hp:t>');
  assert(sec14 !== sec0 && !/<hp:t>본문(?: |<hp:fwSpace\/>)\d/.test(sec14));
  renamed['Contents/section0.xml'] = new TextEncoder().encode(sec14);
  assert.strictEqual(fileTool.readTemplate(renamed).cover.text, '영어 2 (YBM 박준언) 4과');
  const sec2 = dec((await fileTool.unzip(fileTool.makeFile(renamed, seed.replace('본문 1', '14-E').replace('본문 2', '프린트 1번'), {})))['Contents/section0.xml']);
  assert.strictEqual((sec2.match(/<hp:t>14-E<\/hp:t>/g) || []).length, 2, 'title in 좌본문 우해석 and 한 줄 해석');
  assert.strictEqual((sec2.match(/<hp:t>프린트 1번<\/hp:t>/g) || []).length, 2);
  console.log('수업 자료 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 문장 빈칸 파일 (어휘.html + hwpx.js + wbfile.js): template = the finished 문장 빈칸 on this computer (samples/ is not in git)
const sentPath = __dirname + '/samples/1. 영어 2_YBM 박준언_4과_문장 빈칸.hwpx';
if (!fs.existsSync(sentPath)) console.log('문장 빈칸 파일: template not here, file checks skipped');
else (async () => {
  const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
    fs.readFileSync(__dirname + '/어휘.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.markRepeats=markRepeats;this.parse=parse;this.unzip=unzip;this.sentenceFile=sentenceFile;this.readSentenceTemplate=readSentenceTemplate;this.EX=VOCAB_EXAMPLE;', S);
  const files = await S.unzip(fs.readFileSync(sentPath), inflate), T = S.readSentenceTemplate(files);
  assert.deepStrictEqual([T.titleId, T.blankId, T.textId, T.koId, T.lesson, T.academy, !!T.noteTitle],
    ['19', '14', '37', '12', 'Lesson 04. The Guardian of the Blue Heart of the Planet', '남양주 대치하이 영어학원', true]);
  assert.strictEqual(T.page, 2, 'first page number read from the template');
  const secs = S.parse(S.EX + '\n\n본문 2\nShe [explored] the sea and [loved] it. Then she explored more. No blank here.\n그녀는 바다를 탐험했고 그것을 사랑했다. 그 후 그녀는 더 탐험했다. 빈칸 없음.');
  S.markRepeats(secs);
  const out = await S.unzip(S.sentenceFile(files, secs, { lesson: 'Lesson 9. Test', academy: '반포 센티움학원', page: 7 }), inflate);
  assert.deepStrictEqual(Object.keys(out), Object.keys(files), 'same parts, same order');
  const sec = dec(out['Contents/section0.xml']), masters = dec(out['Contents/masterpage0.xml']) + dec(out['Contents/masterpage1.xml']);
  // 미주 numbered from 1 in each 본문; [+...] joins its blank; the repeat keeps its hint letter
  assert.strictEqual([...sec.matchAll(/numType="ENDNOTE">[\s\S]*?<hp:t> ([^<]*)/g)].map(m => m[1]).join('|'), 'visited|amazed by|colorful|realized|is / full of|protection|(v)isit|explored|loved|(e)xplored');
  assert.deepStrictEqual([...sec.matchAll(/<hp:autoNum num="(\d+)" numType="ENDNOTE"/g)].map(m => +m[1]), [1, 2, 3, 4, 5, 6, 7, 1, 2, 3]);
  assert.strictEqual((sec.match(/<hp:newNum num="1" numType="ENDNOTE"\/>/g) || []).length, 2, '미주 번호 restarts per 본문');
  assert(sec.includes('<hp:run charPrIDRef="37"><hp:t>e</hp:t></hp:run><hp:run charPrIDRef="14"><hp:t>xplored</hp:t>'), 'hint letter black, rest white');
  assert(sec.includes('>ANSWER<') && !sec.includes('Sylvia') && !sec.includes('No blank here'), 'answer part kept, old text and blank-free sentence gone');
  assert(masters.includes('Lesson 9. Test') && !masters.includes('Guardian') && masters.includes('<hp:t>반포 센티움학원 김진혁 영어'));
  // page number: one '새 번호로 시작' with the given number; empty → none
  assert.deepStrictEqual([...sec.matchAll(/<hp:newNum num="(\d+)" numType="PAGE"\/>/g)].map(m => +m[1]), [7]);
  const none = dec((await S.unzip(S.sentenceFile(files, secs, { page: null }), inflate))['Contents/section0.xml']);
  assert(!none.includes('numType="PAGE"'), 'empty page number: counts from 1');
  // 미주 title: 본문 1 right after ANSWER, 본문 2 with one empty line above it
  const heads = [...sec.matchAll(/<hp:subList [^>]*>((?:(?!<hp:autoNum)[\s\S])*?)<hp:p [^>]*><hp:run charPrIDRef="\d+"><hp:ctrl><hp:autoNum num="1"/g)].map(m => (m[1].match(/<hp:p /g) || []).length);
  assert.deepStrictEqual(heads, [1, 2], 'title alone, then empty line + title');
  console.log('문장 빈칸 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 문단 빈칸 파일: template = the finished 문단 빈칸 on this computer
const paraPath = __dirname + '/samples/2. 영어 2_YBM 박준언_4과_문단 빈칸.hwpx';
if (!fs.existsSync(paraPath)) console.log('문단 빈칸 파일: template not here, file checks skipped');
else (async () => {
  const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
    fs.readFileSync(__dirname + '/어휘.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.markRepeats=markRepeats;this.parse=parse;this.unzip=unzip;this.paragraphFile=paragraphFile;this.readParagraphTemplate=readParagraphTemplate;', S);
  const files = await S.unzip(fs.readFileSync(paraPath), inflate), T = S.readParagraphTemplate(files);
  assert.deepStrictEqual([T.titleId, T.noteRun, T.blankId, T.textId, T.koId, T.ansId, T.plainId, T.noteTitleId, T.page, T.academy],
    ['25', '26', '28', '30', '16', '44', '18', '45', 18, '남양주 대치하이 영어학원']);
  const input = `본문 1
She [explored] the sea. She [loved] it.
그녀는 바다를 탐험했다. 그녀는 그것을 사랑했다.

Then she explored more.
그 후 그녀는 더 탐험했다.

본문 2
No blank here at all.
빈칸이 전혀 없다.`;
  const secs = S.parse(input);
  S.markRepeats(secs);
  const out = await S.unzip(S.paragraphFile(files, secs, { lesson: 'Lesson 9. Test', academy: '압구정 센티움학원', page: 3 }), inflate);
  assert.deepStrictEqual(Object.keys(out), Object.keys(files), 'same parts, same order');
  const sec = dec(out['Contents/section0.xml']), masters = dec(out['Contents/masterpage0.xml']) + dec(out['Contents/masterpage1.xml']);
  const notes = [...sec.matchAll(/<hp:endNote [^>]*>([\s\S]*?)<\/hp:endNote>/g)].map(m => m[1]);
  assert.strictEqual(notes.length, 2, 'one hidden 미주 per 본문');
  const noteText = n => [...n.matchAll(/<hp:p [^>]*>([\s\S]*?)<\/hp:p>/g)].map(p => p[1].replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(noteText(notes[0]), ['본문 1', 'She explored the sea. She loved it.', 'Then she explored more.']);
  assert.deepStrictEqual(noteText(notes[1]), ['', '본문 2', 'No blank here at all.'], '본문 2: empty line above its title');
  assert(notes[0].includes('<hp:run charPrIDRef="18"><hp:t>e</hp:t></hp:run><hp:run charPrIDRef="44"><hp:t>xplored</hp:t>'), 'answer marked, hint letter plain');
  const body = sec.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '');
  assert.strictEqual((body.match(/<hp:t>본문 1<\/hp:t>/g) || []).length, 2, 'each 본문 twice');
  assert.strictEqual((body.match(/그녀는 바다를 탐험했다\. 그녀는 그것을 사랑했다\./g) || []).length, 1, '해석 only in the first copy, one per English paragraph');
  assert.strictEqual((body.match(/<hp:run charPrIDRef="28"><hp:t>explored<\/hp:t>/g) || []).length, 2);
  assert(body.includes('<hp:run charPrIDRef="30"><hp:t>e</hp:t></hp:run><hp:run charPrIDRef="28"><hp:t>xplored</hp:t>'), 'repeat: hint letter black');
  assert(!/Sylvia|Duarte/.test(sec) && sec.includes('>ANSWER<'), 'old text gone, ANSWER kept');
  assert.deepStrictEqual([...sec.matchAll(/<hp:newNum num="(\d+)" numType="PAGE"\/>/g)].map(m => +m[1]), [3]);
  assert(masters.includes('Lesson 9. Test') && masters.includes('<hp:t>압구정 센티움학원 김진혁 영어') && !masters.includes('대치하이'));
  console.log('문단 빈칸 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 동사 지도 파일: template = the finished 동사 지도 on this computer. The sample's own 4과, turned back into 전처리
// ([base = answer] from its passages and answer list), must come out with the same passages, answers and table sizes.
const verbPath = __dirname + '/samples/3. 영어_2_YBM_박준언_4과_동사 지도.hwpx';
if (!fs.existsSync(verbPath)) console.log('동사 지도 파일: template not here, file checks skipped');
else (async () => {
  const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
    fs.readFileSync(__dirname + '/어법.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.verbMap=verbMap;this.unzip=unzip;this.verbFile=verbFile;this.readVerbTemplate=readVerbTemplate;this.topParas=topParas;', S);
  const files = await S.unzip(fs.readFileSync(verbPath), inflate), T = S.readVerbTemplate(files);
  assert.deepStrictEqual([T.titleId, T.noteRun, T.baseId, T.fw, T.page, T.academy, /colCnt="4"/.test(T.table)], ['17', '14', '24', true, 37, '남양주 대치하이 영어학원', true]);
  // the sample, back to 전처리
  const read = sec => {
    const ps = S.topParas(sec), out = [];
    let cur = null;
    for (const p of ps) {
      const own = p.xml.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<[^>]+>/g, '').trim(); // without the hidden 미주
      if (/styleIDRef="1"/.test(p.xml) && own) { cur = { title: own, paras: [] }; out.push(cur); }
      else if (cur && /styleIDRef="2"/.test(p.xml) && !p.xml.includes("<hp:tbl ")) cur.paras.push(p.xml.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, ''));
    }
    const notes = [...sec.matchAll(/<hp:endNote [^>]*>([\s\S]*?)<\/hp:endNote>/g)].map(m => S.topParas(m[1]).map(p => p.text).filter(Boolean)).flat();
    return { secs: out, notes };
  };
  const vis = x => x.replace(/<hp:fwSpace\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const orig = read(dec(files['Contents/section0.xml']));
  let title = '';
  const ans = {};
  orig.notes.forEach(l => { if (!/^[➊-➓⓫-⓴]/.test(l)) title = l.trim(); else (ans[title] = ans[title] || []).push(l.slice(1).trim()); });
  const input = orig.secs.map(s => { let k = 0; return "# " + s.title + '\n' + s.paras.map(p => {
    return vis(p).replace(/[➊-➓⓫-⓴] \( ?([^)]*?) ?\)/g, (_, base) => `[${base.trim()} = ${ans[s.title][k++]}]`);
  }).join('\n\n'); }).join('\n\n');
  const data = S.verbMap(input);
  const out = await S.unzip(S.verbFile(files, data, { page: 37 }), inflate);
  const sec = dec(out['Contents/section0.xml']), made = read(sec);
  assert.deepStrictEqual(made.secs.map(s => s.title), orig.secs.map(s => s.title), 'same 본문');
  made.secs.forEach((s, i) => assert.deepStrictEqual(s.paras.map(vis), orig.secs[i].paras.map(vis), s.title + ' passage'));
  assert.deepStrictEqual(made.notes.map(l => l.trim()), orig.notes.map(l => l.trim()), 'same answer lines');
  // tables: 4 columns, half as many rows as questions, numbers down the left pair first
  const tables = [...sec.matchAll(/<hp:tbl [^>]*rowCnt="(\d+)" colCnt="(\d+)"[\s\S]*?<\/hp:tbl>/g)];
  assert.deepStrictEqual(tables.map(t => [+t[1], +t[2]]), plain(data.secs.map(s => [Math.ceil(s.answers.length / 2), 4])));
  const cells = t => [...t.matchAll(/<hp:tc [\s\S]*?<\/hp:tc>/g)].map(c => c[0].replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(cells(tables[0][0]), ['➊', '', '➎', '', '➋', '', '➏', '', '➌', '', '➐', '', '➍', '', '', ''], '7 questions: ➊-➍ | ➎-➐');
  assert.strictEqual(new Set(tables.map(t => t[0].match(/ id="(\d+)"/)[1])).size, tables.length, 'table ids differ');
  console.log('동사 지도 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 어법 선택형 파일: template = the finished 어법 선택형 on this computer. Its own 4과, turned back into 전처리
// (* on the options its 미주 give as answers), must come out with the same sentences, 해석 and answers.
const choicePath = __dirname + '/samples/4. 영어_2_YBM_박준언_4과_어법 선택형.hwpx';
if (!fs.existsSync(choicePath)) console.log('어법 선택형 파일: template not here, file checks skipped');
else (async () => {
  const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
    fs.readFileSync(__dirname + '/어법.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.choiceMap=choiceMap;this.unzip=unzip;this.choiceFile=choiceFile;this.readChoiceTemplate=readChoiceTemplate;this.topParas=topParas;', S);
  const files = await S.unzip(fs.readFileSync(choicePath), inflate), T = S.readChoiceTemplate(files);
  assert.deepStrictEqual([T.gap, T.markId, T.textId, T.page, T.academy], [5, '13', '16', 47, '남양주 대치하이 영어학원']);
  const vis = x => x.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<hp:fwSpace\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // sentences (English + 해석) per 본문, and the 미주 answers in order
  const read = sec => {
    const out = [];
    let cur = null;
    for (const p of S.topParas(sec)) {
      const own = vis(p.xml);
      if (/styleIDRef="1"/.test(p.xml) && own) { cur = { title: own, en: [], ko: [] }; out.push(cur); }
      else if (cur && /styleIDRef="2"/.test(p.xml) && own) cur.en.push(own);
      else if (cur && /styleIDRef="3"/.test(p.xml) && own) cur.ko.push(own);
    }
    const answers = [...sec.matchAll(/<hp:autoNum [^>]*numType="ENDNOTE">[\s\S]*?<\/hp:autoNum><\/hp:ctrl>([\s\S]*?)<\/hp:p>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    return { secs: out, answers };
  };
  const orig = read(dec(files['Contents/section0.xml']));
  let k = 0;
  const input = orig.secs.map(s => '# ' + s.title + '\n' + s.en.map((e, j) => e.replace(/\[ ?([^\]]*?) ?\]/g, (_, b) => {
    const right = orig.answers[k++].replace(/\(.*\)$/, '').split(' 또는 ').map(x => x.trim());
    return '[' + b.split('/').map(x => x.trim()).map(x => (right.includes(x) ? '*' : '') + x).join('/') + ']';
  }) + '\n' + (s.ko[j] || '')).join('\n')).join('\n\n');
  const data = S.choiceMap(input);
  const out = await S.unzip(S.choiceFile(files, data, {}), inflate);
  const made = read(dec(out['Contents/section0.xml']));
  const norm = x => x.replace(/\[ /g, '[').replace(/ \]/g, ']').replace(/ \/ /g, '/');
  assert.deepStrictEqual(made.secs.map(s => s.title), orig.secs.map(s => s.title), 'same 본문');
  made.secs.forEach((s, i) => {
    assert.deepStrictEqual(s.en.map(norm), orig.secs[i].en.map(norm), s.title + ' sentences');
    assert.deepStrictEqual(s.ko, orig.secs[i].ko, s.title + ' 해석');
  });
  const bare = a => a.replace(/\s*\(.*\)$/, '').trim();
  // the sample's own two mistakes (a doubled option; a missing / in "preventingprevented") are the only differences
  const diff = made.answers.map(bare).map((a, i) => a === bare(orig.answers[i]) ? null : [a, bare(orig.answers[i])]).filter(Boolean);
  assert.deepStrictEqual(diff, [['having been chosen 또는 having been chosen', 'having been chosen'], ['', 'preventing']], 'same answers');
  const sec = dec(out['Contents/section0.xml']);
  assert(sec.includes('<hp:run charPrIDRef="13"><hp:t>[<hp:fwSpace/>fascinated<hp:fwSpace/>/<hp:fwSpace/>were fascinated<hp:fwSpace/>]</hp:t>'), 'fixed-width spaces in the brackets');
  assert.strictEqual((sec.match(/<hp:newNum num="1" numType="ENDNOTE"\/>/g) || []).length, made.secs.length, '미주 번호 restarts per 본문');
  console.log('어법 선택형 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 어법 고치기 파일: template = the finished 어법 고치기 on this computer. Its own 4과, turned back into 전처리 ([wrong = right]:
// wrong from the problem passage, right from the marked parts of the answer 미주), must come out the same.
const fixPath = __dirname + '/samples/5. 영어 2_YBM 박준언_4과_어법 고치기.hwpx';
if (!fs.existsSync(fixPath)) console.log('어법 고치기 파일: template not here, file checks skipped');
else (async () => {
  const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
  vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
    fs.readFileSync(__dirname + '/어법.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.fixMap=fixMap;this.unzip=unzip;this.fixFile=fixFile;this.readFixTemplate=readFixTemplate;this.topParas=topParas;this.charOf=charOf;', S);
  const files = await S.unzip(fs.readFileSync(fixPath), inflate), T = S.readFixTemplate(files);
  assert.deepStrictEqual([T.titleId, T.noteRun, T.ansId, T.plainId, T.page, T.academy], ['21', '22', '24', '25', 62, '압구정 센티움학원']);
  const vis = x => x.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<hp:fwSpace\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // per 본문: title, problem passages, answer passages as [text, marked?] pieces
  const read = (sec, header) => {
    const out = [], marked = id => /underline type="BOTTOM"/.test(S.charOf(header, id));
    let cur = null;
    for (const p of S.topParas(sec)) {
      const own = vis(p.xml);
      if (/styleIDRef="1"/.test(p.xml) && own) { cur = { title: own, q: [], a: [] }; out.push(cur); }
      else if (cur && own && own !== 'ANSWER') cur.q.push(own);
      const note = p.xml.match(/<hp:endNote [^>]*>([\s\S]*?)<\/hp:endNote>/);
      if (cur && note) cur.a = S.topParas(note[1].replace(/^<hp:subList [^>]*>/, '').replace(/<\/hp:subList>$/, '')).filter(x => x.text.length >= 30)
        .map(x => [...x.xml.matchAll(/<hp:run charPrIDRef="(\d+)"><hp:t>([\s\S]*?)<\/hp:t>/g)].map(r => [r[2].replace(/<hp:fwSpace\/>/g, ' '), marked(r[1])]));
    }
    return out;
  };
  const orig = read(dec(files['Contents/section0.xml']), dec(files['Contents/header.xml']));
  const input = orig.map(s => '# ' + s.title.replace(/ \(\d+개\)$/, '') + '\n' + s.q.map((q, j) => {
    // join the pieces: same kind in a row, and a spaces-only piece between two marked ones belongs to them
    const pcs = [];
    s.a[j].forEach(([text, mark], i, all) => {
      const m = mark || (!text.trim() && i > 0 && i < all.length - 1 && all[i - 1][1] && all[i + 1][1]);
      if (pcs.length && pcs[pcs.length - 1][1] === m) pcs[pcs.length - 1][0] += text; else pcs.push([text, m]);
    });
    let cur = 0, pending = null, outp = '';
    for (const [text, mark] of pcs.concat([['', false]])) {
      if (mark) { pending = text; continue; }
      const core = text.trim(), at = core ? q.indexOf(core, cur) : q.length; // spaces may differ
      if (at < 0) throw new Error('rebuild: not found ' + core.slice(0, 40));
      if (pending !== null) { outp += ` [${q.slice(cur, at).trim()} = ${pending.trim().replace(/ \[또는 (.*)\]$/, ' 또는 $1')}] `; pending = null; }
      else outp += q.slice(cur, at);
      outp += core; cur = at + core.length;
    }
    return outp;
  }).join('\n\n')).join('\n\n');
  const data = S.fixMap(input);
  const out = await S.unzip(S.fixFile(files, data, {}), inflate);
  const made = read(dec(out['Contents/section0.xml']), dec(out['Contents/header.xml']));
  const flat = a => a.map(p => p.map(([t, m]) => m ? '{' + t + '}' : t).join('').replace(/\s+/g, ' ').replace(/ \}/g, '} ').replace(/\{ /g, ' {').trim());
  assert.deepStrictEqual(made.map(s => s.title), orig.map(s => s.title), 'same titles with (N개)');
  made.forEach((s, i) => {
    assert.deepStrictEqual(s.q, orig[i].q, s.title + ' problem');
    assert.deepStrictEqual(flat(s.a), flat(orig[i].a), s.title + ' answer');
  });
  const sec = dec(out['Contents/section0.xml']);
  assert(sec.includes('breathing<hp:fwSpace/>[또는 she breathed]'), 'several answers: original style');
  console.log('어법 고치기 파일 checks passed');
})().catch(e => { console.error(e); process.exit(1); });

// 배열 영작 · 통영작 파일: templates = the finished files on this computer. Each sample's own 4과, turned back into 전처리
// (answers from its 미주), must come out with the same 해석, the same words in each [ ] / blank, and the same answers.
for (const [kind, file, full] of [['arrange', '6. 영어_2_YBM_박준언_4과_배열 영작.hwpx', false], ['full', '7. 영어_2_YBM_박준언_4과_통영작.hwpx', true]]) {
  const path = __dirname + '/samples/' + file;
  if (!fs.existsSync(path)) { console.log(kind + ' 파일: template not here, file checks skipped'); continue; }
  (async () => {
    const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
    vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
      fs.readFileSync(__dirname + '/영작.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.writeMap=writeMap;this.unzip=unzip;this.writeFile=writeFile;this.readWriteTemplate=readWriteTemplate;this.topParas=topParas;this.charOf=charOf;', S);
    const files = await S.unzip(fs.readFileSync(path), inflate), T = S.readWriteTemplate(files, kind, full);
    assert.deepStrictEqual([T.gap, !!T.noteRun, full ? !!T.blankId : !!T.markId], [full ? 3 : 5, true, true], kind + ' template');
    // per 본문: title; per sentence: 해석, English pieces [text, blank/bracket?]; and the 미주 answers in order
    const read = (sec, header) => {
      const white = id => /textColor="#FFFFFF"/.test(S.charOf(header, id)), out = [];
      let cur = null;
      for (const p of S.topParas(sec)) {
        const x = p.xml.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
        const own = x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (/styleIDRef="1"/.test(p.xml) && own) { cur = { title: own, sents: [] }; out.push(cur); }
        else if (cur && p.xml.includes('<hp:endNote ')) cur.sents.push({ ko: own, en: [] });
        else if (cur && own && own !== 'ANSWER' && cur.sents.length) cur.sents[cur.sents.length - 1].en.push(...[...x.matchAll(/<hp:run charPrIDRef="(\d+)"><hp:t>([\s\S]*?)<\/hp:t>/g)]
          .map(r => [r[2], full ? white(r[1]) : /^\s*\[/.test(r[2])]));
      }
      const answers = [...sec.matchAll(/<hp:autoNum [^>]*numType="ENDNOTE">[\s\S]*?<\/hp:autoNum><\/hp:ctrl>([\s\S]*?)<\/hp:p>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      return { secs: out, answers };
    };
    // blanks / brackets of one sentence as groups of words (a space between two blank words keeps them in one group)
    const groups = en => {
      if (!full) return (en.map(([t]) => t).join('').match(/\[[^\]]*\]/g) || []).map(x => x.replace(/[\[\]\/]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' '));
      // 통영작: blank pieces joined across gaps of only spaces / punctuation
      const marked = en.map(([t, b]) => b ? '\u0001' + t + '\u0002' : t).join('').replace(/\u0002([^A-Za-z0-9\u0001\u0002]*)\u0001/g, '$1');
      if (marked) return [...marked.matchAll(/\u0001([^\u0002]*)\u0002/g)].map(m => m[1].split(/\s+/).filter(Boolean).sort().join(' '));
      const g = [];
      let open = false;
      en.forEach(([t, b], i) => {
        if (b) { if (!open) g.push(''); g[g.length - 1] += t; open = true; }
        else if (!(full && !/[A-Za-z0-9]/.test(t) && open && en[i + 1] && en[i + 1][1])) open = false;
        else g[g.length - 1] += t;
      });
      return g.map(x => x.replace(/[\[\]\/]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' '));
    };
    const plainText = en => en.map(([t, b]) => b ? '#' : t).join('').replace(full ? /#+([^A-Za-z0-9#]+#+)*/g : /#+(\s#+)*/g, '#').replace(/\s+/g, ' ').trim(); // friend’s: one blank
    const orig = read(dec(files['Contents/section0.xml']), dec(files['Contents/header.xml']));
    let k = 0;
    const unclear = new Set(); // sentences where the sample's blanks can't be split back into its answers
    const input = orig.secs.map((s, i) => '# ' + s.title + '\n' + s.sents.map((st, j) => {
      const ans = orig.answers[k++].split(/ *\/ */), p = plainText(st.en);
      if ((p.match(/#/g) || []).length !== ans.length) { unclear.add(i + '-' + j); unclear.add(k - 1); }
      let a = 0;
      return p.replace(/#/g, () => `[${ans[a++]}]`) + '\n' + st.ko.replace(/^\d+\)\s*/, '');
    }).join('\n')).join('\n\n');
    assert(unclear.size <= 2, kind + ': too many sentences could not be rebuilt: ' + unclear.size);
    const out = await S.unzip(S.writeFile(files, S.writeMap(kind, input), {}, full), inflate);
    const made = read(dec(out['Contents/section0.xml']), dec(out['Contents/header.xml']));
    assert.deepStrictEqual(made.secs.map(s => s.title), orig.secs.map(s => s.title), kind + ' 본문');
    made.secs.forEach((s, i) => s.sents.forEach((st, j) => {
      const o = orig.secs[i].sents[j];
      assert.strictEqual(st.ko, o.ko.replace(/^\d+\)\s*/, ''), `${kind} ${s.title} ${j + 1} 해석`);
      if (unclear.has(i + '-' + j)) return;
      assert.strictEqual(plainText(st.en), plainText(o.en), `${kind} ${s.title} ${j + 1} English`);
      const low = g => g.map(x => x.toLowerCase().split(' ').sort().join(' '));
      assert.deepStrictEqual(low(groups(st.en)), low(groups(o.en)), `${kind} ${s.title} ${j + 1} words in the blanks`);
    }));
    const sl = a => a.map(x => x.replace(/ *\/ */g, ' / '));
    const keep = a => sl(a).filter((x, i) => !unclear.has(i));
    assert.deepStrictEqual(keep(made.answers), keep(orig.answers), kind + ' answers');
    assert.strictEqual(made.answers.length, orig.answers.length, kind + ' answer count');
    console.log(kind + ' 파일 checks passed');
  })().catch(e => { console.error(e); process.exit(1); });
}

// 예문장 · 예문장 빈칸 파일 (수업.html): templates = the finished files on this computer. Each sample's own 4과, turned back
// into 전처리 ([target] from the marked / blank words), must come out with the same sentences, 해석 and answers.
for (const [kind, file] of [['example', '1. 영어2_YBM_박준언_4과_예문장.hwpx'], ['exblank', '2. 영어2_YBM_박준언_4과_예문장_빈칸.hwpx']]) {
  const path = __dirname + '/samples/' + file;
  if (!fs.existsSync(path)) { console.log(kind + ' 파일: template not here, file checks skipped'); continue; }
  (async () => {
    const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
    vm.runInNewContext(common + ['hwpx.js', 'wbfile.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
      fs.readFileSync(__dirname + '/수업.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1] + ';this.exampleMap=exampleMap;this.parse=parse;this.unzip=unzip;this.exampleFile=exampleFile;this.sentenceFile=sentenceFile;this.topParas=topParas;this.charOf=charOf;', S);
    const files = await S.unzip(fs.readFileSync(path), inflate);
    const vis = x => x.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').replace(/<hp:lineBreak\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    // per 본문: title, word lines, sentences as [text, target?] pieces, 해석; 미주 answers in order
    const read = (sec, header) => {
      const target = id => kind === 'example' ? /underline type="BOTTOM"/.test(S.charOf(header, id)) : /textColor="#FFFFFF"/.test(S.charOf(header, id));
      const out = [];
      let cur = null;
      for (const p of S.topParas(sec)) {
        const own = vis(p.xml);
        if (!own || own === 'ANSWER') continue;
        if (/styleIDRef="1"/.test(p.xml) && !own.includes(':')) { cur = { title: own, words: [], sents: [] }; out.push(cur); }
        else if (!cur) continue;
        else if (/styleIDRef="1"/.test(p.xml)) cur.words.push(own.split(':')[0].trim());
        else if (/styleIDRef="2"/.test(p.xml)) {
          // pieces [text, target?, 미주 here?] in order; a 미주 stands right before the blank it answers
          const en = [];
          let id = null;
          for (const m of p.xml.replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '<NOTE/>').matchAll(/<hp:run charPrIDRef="(\d+)">|<hp:t>([\s\S]*?)<\/hp:t>|<NOTE\/>/g)) {
            if (m[1]) id = m[1];
            else if (m[0] === '<NOTE/>') en.push(['', false, true]);
            else en.push([m[2], target(id), false]);
          }
          cur.sents.push({ en, ko: '' });
        }
        else if (/styleIDRef="3"/.test(p.xml) && cur.sents.length) cur.sents[cur.sents.length - 1].ko = own;
      }
      const answers = [...sec.matchAll(/<hp:autoNum [^>]*numType="ENDNOTE">[\s\S]*?<\/hp:autoNum><\/hp:ctrl>([\s\S]*?)<\/hp:p>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      return { secs: out, answers };
    };
    // the sentence with [ ] around each target (a space between two target words keeps them in one [ ])
    // (예문장: each target is a run of its own, so neighbouring targets stay apart; 예문장 빈칸: one run per word, joined)
    const brackets = en => en.map(([t, b]) => b ? '\u0001' + t + '\u0002' : t).join('').replace(kind === 'example' ? /\u0002()\u0001/g : /\u0002(\s*)\u0001/g, '$1')
      .replace(/\u0001/g, '[').replace(/\u0002/g, ']').replace(/\]-\[/g, '-').replace(/\s+/g, ' ').trim(); // non-profit: the sample showed the hyphen
    const orig = read(dec(files['Contents/section0.xml']), dec(files['Contents/header.xml']));
    const dropped = orig.secs.reduce((n, s) => n + s.sents.filter(st => !st.en.some(x => x[1])).length, 0);
    orig.secs.forEach(s => { s.sents = s.sents.filter(st => st.en.some(x => x[1])); }); // a sentence without targets is left out, like the copy output
    assert(dropped <= 1, kind + ': sentences without targets ' + dropped);
    // 예문장 빈칸: a blank right after a 미주 opens a new [ ]; blank words without one join the sentence's previous [ ] as [+...]
    const rebuild = en => {
      let out = '', open = false, note = false;
      en.forEach(([t, b, n], i) => {
        if (n) { if (open) { out += ']'; open = false; } note = true; return; }
        if (b && t.trim()) {
          if (!open) { out += note ? '[' : '[+'; open = true; note = false; }
          out += t;
          return;
        }
        const nextBlank = en.slice(i + 1).find(x => x[2] || x[0]);
        if (open && /^[\s-]*$/.test(t) && nextBlank && nextBlank[1] && !nextBlank[2]) { out += t; return; } // space (or the hyphen of non-profit) inside one blank
        if (open) { out += ']'; open = false; }
        out += t;
      });
      return (out + (open ? ']' : '')).replace(/\s+/g, ' ').trim();
    };
    const input = orig.secs.map(s => '# ' + s.title + '\n' + s.sents.map(st => (kind === 'example' ? brackets(st.en) : rebuild(st.en)) + '\n' + st.ko).join('\n')).join('\n\n');
    const secs = S.parse(input);
    const bytes = kind === 'example' ? S.exampleFile(files, S.exampleMap(secs), {}) : S.sentenceFile(files, secs, {}, true);
    const out = await S.unzip(bytes, inflate), sec = dec(out['Contents/section0.xml']);
    const made = read(sec, dec(out['Contents/header.xml']));
    assert.deepStrictEqual(made.secs.map(s => s.title), orig.secs.map(s => s.title), kind + ' 본문');
    made.secs.forEach((s, i) => {
      assert.deepStrictEqual(s.sents.map(st => brackets(st.en)), orig.secs[i].sents.map(st => brackets(st.en)), kind + ' ' + s.title + ' sentences');
      assert.deepStrictEqual(s.sents.map(st => st.ko), orig.secs[i].sents.map(st => st.ko), kind + ' ' + s.title + ' 해석');
    });
    if (kind === 'example') {
      // word lists: the tool's 원형 against the user's finished list (the rest are the user's own edits, e.g. help A with B)
      const a = made.secs.flatMap(s => s.words), b = orig.secs.flatMap(s => s.words);
      const same = a.filter(w => b.includes(w)).length;
      if (process.env.DBG) console.log('TOOL ONLY:', a.filter(w => !b.includes(w)).join(' | '), '\nSAMPLE ONLY:', b.filter(w => !a.includes(w)).join(' | '));
      assert(same / b.length > 0.9, `word lists: only ${same} of ${b.length} the same`);
      assert(!sec.includes('<hp:endNote ') && !sec.includes('>ANSWER<'), 'no 미주, no ANSWER');
    } else {
      // the sample's own slip is the only difference: its blank covers "mass media" but its answer says "mass"
      const sp = x => x.replace(/\s+/g, ' ').replace(/ *\/ */g, ' / ');
      const diff = made.answers.map((a, i) => sp(a) === sp(orig.answers[i]) ? null : [sp(a), sp(orig.answers[i])]).filter(Boolean);
      assert.deepStrictEqual(diff, [['mass media', 'mass']], kind + ' answers');
      assert.strictEqual(made.answers.length, orig.answers.length, kind + ' answer count');
    }
    console.log(kind + ' 파일 checks passed');
  })().catch(e => { console.error(e); process.exit(1); });
}

// 문제집 서식 입히기 (qbook.js): the user's draft and finished 문제집 on this computer (samples/ is not in git)
const bookTpl = __dirname + '/samples/문제집 샘플.hwpx', bookDraft = __dirname + '/samples/출제 문제 샘플.hwpx';
if (fs.existsSync(bookTpl) && fs.existsSync(bookDraft)) {
  (async () => {
    const S = { TextDecoder, TextEncoder }, zlib = require('zlib'), inflate = async d => zlib.inflateRawSync(d), dec = b => new TextDecoder().decode(b);
    vm.runInNewContext(['hwpx.js', 'qbook.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n') +
      ';this.unzip=unzip;this.bookFile=bookFile;this.readBookTemplate=readBookTemplate;this.bookFields=bookFields;this.hwpText=hwpText;', S);
    const tpl = await S.unzip(fs.readFileSync(bookTpl), inflate), draft = await S.unzip(fs.readFileSync(bookDraft), inflate);
    const T = S.readBookTemplate(tpl);
    assert.strictEqual(JSON.stringify(S.bookFields(tpl, T).map(f => f.text)), JSON.stringify(['공통영어 2 (미래엔)', '03', '압구정고 1학년', ' 진짜 혁신 교과서편 (2차)']), '바탕쪽 칸');
    const r = S.bookFile(tpl, draft, { academy: '반포 센티움학원', fields: { '03': '05' } });
    const out = await S.unzip(r.bytes, inflate), sec = dec(out['Contents/section0.xml']), head = dec(out['Contents/header.xml']);
    // every letter of the draft is there, in order: only its 머리말 goes, and its "Answer" line becomes the template's "ANSWER"
    const letters = x => S.hwpText(x.replace(/<hp:ctrl><hp:header\b[\s\S]*?<\/hp:header><\/hp:ctrl>/g, '')).replace(/\s+/g, '');
    assert.strictEqual(letters(sec), letters(dec(draft['Contents/section0.xml'])).replace(/Answer$/, 'ANSWER'), 'letters');
    assert.strictEqual(sec.split('<hp:endNote ').length, 88, '87 미주');
    assert.strictEqual(r.counts.문제, 89, 'questions');
    assert.strictEqual(r.warnings.length, 2, 'two 문제 without 미주: ' + r.warnings.join(' / '));
    // every style the body uses exists, the counts in the header match, letters: template fonts, 자간 0
    const used = (ref) => new Set([...sec.matchAll(new RegExp(ref + 'IDRef="(\\d+)"', 'g'))].map(m => m[1]));
    [['charPr', 'charProperties'], ['paraPr', 'paraProperties'], ['borderFill', 'borderFills']].forEach(([t, list]) => {
      const ids = [...head.matchAll(new RegExp(`<hh:${t} id="(\\d+)"`, 'g'))].map(m => m[1]);
      assert.strictEqual(+head.match(new RegExp(`<hh:${list} itemCnt="(\\d+)"`))[1], ids.length, t + ' itemCnt');
      used(t).forEach(id => assert(ids.includes(id), t + ' ' + id + ' missing'));
    });
    const def = id => head.match(new RegExp(`<hh:charPr id="${id}"[\\s\\S]*?</hh:charPr>`))[0];
    used('charPr').forEach(id => {
      assert(/hangul="(11|4)"/.test(def(id)), 'font of ' + id);
      assert(/<hh:spacing hangul="0"/.test(def(id)), '자간 of ' + id);
    });
    // 지문 underlines are not bold; the question line keeps 굵게+밑줄
    const runsIn = para => [...sec.matchAll(new RegExp(`<hp:p [^>]*paraPrIDRef="${para}"[^>]*>([\\s\\S]*?)</hp:p>`, 'g'))].flatMap(m => [...m[1].replace(/<hp:endNote [\s\S]*?<\/hp:endNote>/g, '').matchAll(/charPrIDRef="(\d+)"/g)].map(x => x[1]));
    const boldLine = id => /<hh:bold\/>/.test(def(id)) && /<hh:underline type="BOTTOM"/.test(def(id));
    assert(runsIn(T.passage).some(id => /<hh:underline type="BOTTOM"/.test(def(id))) && !runsIn(T.passage).some(boldLine), '지문 밑줄');
    assert(runsIn(T.question).some(boldLine), '문제 줄 굵게+밑줄');
    // new pages: Part 02 / 03, the 묶음 안내 after the first, a 문제 with its own 지문; not a T/F 문제 inside a 묶음
    const at = s => r.paras.find(p => p.text.startsWith(s));
    assert(!at('Part 01').page && at('Part 02').page && at('Part 03').page && !at('[1~10]').page && at('[11~14]').page, 'part / group pages');
    assert(!r.paras.find(p => p.text.startsWith('다음 주어진 문장의 내용이 윗글과 일치하면')).page, 'T/F in a 묶음');
    assert(r.paras.filter(p => p.text.startsWith('다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?')).slice(1).every(p => p.page), '문제 with its own 지문');
    assert.strictEqual(at('③ Another effective method').role, 'passage', '③ starting a 지문');
    assert.strictEqual(at('(1) A habit refers').role, 'hang', 'T/F sentence');
    const masters = Object.keys(out).filter(n => /masterpage/.test(n)).map(n => dec(out[n])).join('');
    assert(masters.includes('<hp:t>05</hp:t>') && !masters.includes('<hp:t>03</hp:t>') && masters.includes('반포 센티움학원'), '바탕쪽');
    console.log('문제집 서식 checks passed');
  })().catch(e => { console.error(e); process.exit(1); });
}
