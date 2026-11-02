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
