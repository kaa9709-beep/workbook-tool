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

// Titles: only lines starting with ■; wrapped PDF lines and a # in a passage are not titles
assert(['■ 본문 1', '■14-E', '■ Into a New World'].every(seedTool.isSeedTitle));
assert(!['본문 1', 'structures', 'Iron Man 2', '#1', '# 본문 2'].some(seedTool.isSeedTitle));
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
console.log('씨드 checks passed');
