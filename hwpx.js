// 한글(.hwpx) files are a zip of XML. Read a template, write a new file from it.
// Shared by 수업용 자료 (and later 문제집). No library: the zip format is small enough to do by hand.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };

// Browser inflate for compressed zip entries (DecompressionStream is in every current browser).
const inflateRaw = async data => new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());

// { name: Uint8Array } in the zip's own order (mimetype first). inflate is injectable for node tests.
async function unzip(buf, inflate = inflateRaw) {
  const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength), files = {};
  let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('한글(.hwpx) 파일이 아니에요. 한글에서 다른 이름으로 저장 → hwpx로 바꿔 주세요.');
  let p = v.getUint32(e + 16, true);
  for (let i = v.getUint16(e + 10, true); i > 0; i--) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nameLen = v.getUint16(p + 28, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen)), off = v.getUint32(p + 42, true);
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = b.subarray(start, start + size);
    files[name] = method === 0 ? data : await inflate(data);
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return files;
}

// Writes every entry uncompressed (stored), keeping the given order. Strings are saved as UTF-8.
function zip(files) {
  const enc = new TextEncoder(), local = [], central = [];
  let off = 0;
  const put = (view, fields) => fields.forEach(([at, x, n]) => n === 4 ? view.setUint32(at, x, true) : view.setUint16(at, x, true));
  for (const [name, d0] of Object.entries(files)) {
    const d = typeof d0 === 'string' ? enc.encode(d0) : d0, nm = enc.encode(name), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    put(h, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x800, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, nm.length, 2]]);
    put(c, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x800, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4], [28, nm.length, 2], [42, off, 4]]);
    local.push(new Uint8Array(h.buffer), nm, d);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0), n = Object.keys(files).length, end = new DataView(new ArrayBuffer(22));
  put(end, [[0, 0x06054b50, 4], [8, n, 2], [10, n, 2], [12, size, 4], [16, off, 4]]);
  const out = new Uint8Array(off + size + 22);
  let at = 0;
  for (const x of local.concat(central, [new Uint8Array(end.buffer)])) { out.set(x, at); at += x.length; }
  return out;
}

const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Visible text only: a shape's comment ("사각형입니다.") is not on the page.
const hwpText = x => x.replace(/<hp:shapeComment>[\s\S]*?<\/hp:shapeComment>/g, '').replace(/<hp:fwSpace\/>/g, ' ').replace(/<hp:lineBreak\/>/g, '\n').replace(/<[^>]+>/g, '');

// Top-level paragraphs of a section (a shape's text box holds paragraphs of its own, so depth is counted).
function topParas(xml) {
  const out = [], re = /<hp:p [^>]*>|<\/hp:p>/g;
  let depth = 0, start = 0, m;
  while ((m = re.exec(xml))) {
    if (m[0][1] !== '/') { if (!depth++) start = m.index; } else if (!--depth) {
      const x = xml.slice(start, re.lastIndex);
      out.push({ start, end: re.lastIndex, xml: x, shape: /<hp:(rect|pic|ellipse|line|polygon|curve|arc|container|tbl)\b/.test(x), text: hwpText(x).trim() });
    }
  }
  return out;
}
const runIds = x => [...x.matchAll(/<hp:run charPrIDRef="(\d+)"/g)].map(m => m[1]);
// A new paragraph shaped like proto: same paragraph style, given runs, no saved line layout (한글 lays it out again).
// pageBreak: true/false sets it, undefined keeps the proto's.
const hwpPara = (proto, runs, pageBreak) => {
  const tag = proto.match(/<hp:p [^>]*>/)[0];
  return (pageBreak === undefined ? tag : tag.replace(/pageBreak="\d"/, `pageBreak="${pageBreak ? 1 : 0}"`)) + runs + '</hp:p>';
};
const hwpRun = (id, inner) => `<hp:run charPrIDRef="${id}"><hp:t>${inner}</hp:t></hp:run>`;

// 바탕쪽 학원 name, the words before "김진혁 영어" (top of the pages). Templates write it in different ways
// ("대치하이 영어학원", "남양주 대치하이 영어학원", "압구정 센티움학원"); the tool always writes one of these three.
const ACADEMIES = ['남양주 대치하이 영어학원', '압구정 센티움학원', '반포 센티움학원'];
const ACADEMY_RE = /<hp:t>([^<]*(?:대치하이|센티움)[^<]*?)(?= 김진혁 영어)/g;
const academyName = s => !s ? '' : ACADEMIES.find(a => a === s) || (/반포/.test(s) ? ACADEMIES[2] : /센티움/.test(s) ? ACADEMIES[1] : ACADEMIES[0]);
const academyOf = xmls => academyName(xmls.map(x => (x.match(new RegExp(ACADEMY_RE.source)) || [])[1]).find(Boolean));
const putAcademy = (x, name) => name ? x.replace(ACADEMY_RE, '<hp:t>' + xmlEsc(name)) : x;

// ── Fitting a line of text in its box (수업용 자료 표지·교재 이름, 예문장 교재 이름) ──

// Text width in 1/1000 of the font size. Letters from each font file; spaces as 한글 draws them (measured on its pages).
const FONTS = {
  '고도 B': { hangul: 930, ascii: [307,370,450,680,618,860,720,282,345,345,550,580,300,530,300,490,570,440,570,570,570,570,570,570,570,570,300,300,560,560,560,459,934,680,656,669,691,605,595,723,676,423,457,665,586,814,691,758,645,763,656,631,605,691,680,935,715,670,602,357,960,357,587,510,358,553,626,532,626,585,430,626,582,278,287,568,252,812,583,618,626,626,450,490,455,574,581,814,570,580,498,450,365,450,610] },
  '페이퍼로지 5 Medium': { hangul: 1111, quote: 251, dquote: 460, ascii: [220,298,434,781,690,958,762,232,318,319,444,647,251,427,251,351,667,667,667,667,667,667,667,667,667,667,251,251,647,647,647,637,1149,739,752,730,824,659,629,782,806,293,508,726,593,976,823,854,713,854,719,622,586,789,718,1156,677,649,660,314,351,314,648,556,421,609,698,580,698,622,350,706,697,271,278,631,271,1081,682,648,698,698,410,507,414,678,567,920,560,567,527,331,332,331,647] },
  '메이플스토리': { hangul: 900, quote: 247, dquote: 457, ascii: [265,292,478,795,669,821,673,258,354,354,472,535,246,519,252,308,675,432,607,601,664,567,600,537,638,605,246,246,429,515,429,578,862,637,639,709,667,566,567,766,672,462,511,641,550,852,672,775,654,775,643,631,623,682,635,900,625,648,607,366,308,366,434,404,259,639,629,576,630,584,505,612,594,227,227,610,234,806,571,630,602,602,482,523,521,568,590,851,577,591,521,424,292,424,558] },
  '한컴 윤체 B': { hangul: 850, ascii: [330,455,328,746,746,746,746,261,261,261,334,455,261,455,261,379,737,426,562,562,562,562,562,562,562,562,261,261,360,455,360,688,820,795,562,814,679,543,533,834,620,203,543,591,523,814,640,834,582,834,582,582,572,601,776,892,776,698,562,261,399,261,388,438,337,649,649,604,649,620,368,649,562,194,271,582,194,814,562,620,649,649,368,460,368,562,582,814,591,582,504,261,261,261,746] },
};
const SPACE = 410, FW_SPACE = 250;
const textWidth = (xml, font) => {
  const f = FONTS[font] || { hangul: 1000 }; // unknown font: assume wide letters, so it shrinks rather than wraps
  let w = (xml.match(/<hp:fwSpace\/>/g) || []).length * FW_SPACE;
  for (const ch of hwpText(xml.replace(/<hp:fwSpace\/>/g, ''))) {
    const c = ch.charCodeAt(0);
    w += c === 32 ? SPACE : c > 32 && c <= 126 ? (f.ascii ? f.ascii[c - 32] : 650) : f.hangul;
  }
  return w;
};
const charPr = (header, id) => header.match(new RegExp('<hh:charPr id="' + id + '"[\\s\\S]*?</hh:charPr>'))[0];
const charHeight = (header, id) => +charPr(header, id).match(/height="(\d+)"/)[1];
// The font a char style uses for 한글 (fontRef → fontface list of HANGUL).
function fontOf(header, id) {
  const ref = charPr(header, id).match(/<hh:fontRef hangul="(\d+)"/)[1];
  const list = header.match(/<hh:fontface lang="HANGUL"[\s\S]*?<\/hh:fontface>/)[0];
  return (list.match(new RegExp('<hh:font id="' + ref + '" face="([^"]*)"')) || [])[1];
}
// A text box around position i: its width, text margins and where the margin tag is.
function boxAt(xml, i) {
  const start = xml.lastIndexOf('<hp:rect', i), rest = xml.slice(i), m = rest.match(/<hp:textMargin left="(\d+)" right="(\d+)"/);
  return { width: +xml.slice(start).match(/<hp:curSz width="(\d+)"/)[1], left: +m[1], right: +m[2] };
}
// Font size (1/100 pt, 0.5 pt steps) for one line; never larger than the template's.
const fitSize = (f, xml) => Math.min(f.base, Math.floor(f.avail * 0.98 / textWidth(xml, f.font) * 1000 / 50) * 50);
const MIN_SIZE = { book: 700, cover: 2000 };
// A smaller size needs its own char style: a copy of the template's with another height, added to H.header once.
// H = { header, sized: {} }.
function sizedChar(H, id, height) {
  const old = charPr(H.header, id);
  if (+old.match(/height="(\d+)"/)[1] === height) return id;
  if (!H.sized[id + '-' + height]) {
    const nid = Math.max(...[...H.header.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => +m[1])) + 1;
    H.header = H.header.replace('</hh:charProperties>', old.replace(/id="\d+" height="\d+"/, `id="${nid}" height="${height}"`) + '</hh:charProperties>')
      .replace(/(<hh:charProperties itemCnt=")(\d+)/, (_, a, n) => a + (+n + 1));
    H.sized[id + '-' + height] = nid;
  }
  return H.sized[id + '-' + height];
}
