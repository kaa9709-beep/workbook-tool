// 씨드 → 한글 파일(.hwpx) without a template: the whole file is written here. Needs hwpx.js (zip, xmlEsc).
// Fixed look (사용자 결정 2026-11-03): A4, margins top/bottom 10 mm, left/right/머리말/꼬리말 15 mm;
// 본문 (영어, 제목 굵게) Pretendard 10 pt, 줄 간격 225 %; 해석 (and * 주석) Pretendard Medium 8 pt, 줄 간격 160 %.
// rows: [{ k: 'title' | 'en' | 'ko' | 'note' | 'gap', t }] in page order ('gap' = an empty 본문 line).

const SEED_NS = 'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
const MM = mm => Math.round(mm * 7200 / 25.4); // HWPUNIT: 1/7200 inch

// header: fonts 0 = Pretendard, 1 = Pretendard Medium; letters 0 본문, 1 본문 굵게, 2 해석; paragraphs 0 본문, 1 해석
function seedHeader() {
  const langs = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];
  const fonts = langs.map(l => `<hh:fontface lang="${l}" fontCnt="2"><hh:font id="0" face="Pretendard" type="TTF" isEmbedded="0"/><hh:font id="1" face="Pretendard Medium" type="TTF" isEmbedded="0"/></hh:fontface>`).join('');
  const border = id => `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>`;
  const all = v => langs.map(l => `${l.toLowerCase()}="${v}"`).join(' ');
  const char = (id, height, font, bold) => `<hh:charPr id="${id}" height="${height}" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2"><hh:fontRef ${all(font)}/><hh:ratio ${all(100)}/><hh:spacing ${all(0)}/><hh:relSz ${all(100)}/><hh:offset ${all(0)}/>${bold ? '<hh:bold/>' : ''}</hh:charPr>`;
  const para = (id, spacing) => `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="${spacing}" unit="HWPUNIT"/><hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
  return XML_HEAD + `<hh:head ${SEED_NS} version="1.2" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>` +
    `<hh:fontfaces itemCnt="7">${fonts}</hh:fontfaces><hh:borderFills itemCnt="2">${border(1)}${border(2)}</hh:borderFills>` +
    `<hh:charProperties itemCnt="3">${char(0, 1000, 0)}${char(1, 1000, 0, true)}${char(2, 800, 1)}</hh:charProperties>` +
    '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>' +
    `<hh:paraProperties itemCnt="2">${para(0, 225)}${para(1, 160)}</hh:paraProperties>` +
    '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>' +
    '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>';
}

// 쪽 설정: A4 (210 × 297 mm), the user's margins; lives in the first paragraph like every 한글 file.
const seedSecPr = () => `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
  `<hp:pagePr landscape="WIDELY" width="${MM(210)}" height="${MM(297)}" gutterType="LEFT_ONLY"><hp:margin header="${MM(15)}" footer="${MM(15)}" gutter="0" left="${MM(15)}" right="${MM(15)}" top="${MM(10)}" bottom="${MM(10)}"/></hp:pagePr>` +
  '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>' +
  '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>' +
  ['BOTH', 'EVEN', 'ODD'].map(t => `<hp:pageBorderFill type="${t}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>`).join('') + '</hp:secPr>';

// The .hwpx bytes for the rows.
function seedFile(rows) {
  const LOOK = { title: [0, 1], en: [0, 0], gap: [0, 0], ko: [1, 2], note: [1, 2] }; // [paragraph, letters]
  const list = rows.length ? rows : [{ k: 'gap', t: '' }];
  const body = list.map((r, i) => {
    const [p, c] = LOOK[r.k], setup = i ? '' : `<hp:run charPrIDRef="0">${seedSecPr()}<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run>`;
    return `<hp:p id="0" paraPrIDRef="${p}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${setup}<hp:run charPrIDRef="${c}">${r.t ? `<hp:t>${xmlEsc(r.t)}</hp:t>` : '<hp:t/>'}</hp:run></hp:p>`;
  }).join('');
  const rdf = part => `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/${part}.xml"/></rdf:Description>`;
  return zip({
    mimetype: 'application/hwp+zip',
    'version.xml': XML_HEAD + '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.2" application="Hancom Office Hangul" appVersion="11, 0, 0, 2613 WIN32LEWindows_8"/>',
    'Contents/header.xml': seedHeader(),
    'Contents/section0.xml': XML_HEAD + `<hs:sec ${SEED_NS}>${body}</hs:sec>`,
    'Preview/PrvText.txt': list.map(r => r.t).join('\r\n').slice(0, 1000),
    'settings.xml': XML_HEAD + '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>',
    'META-INF/container.rdf': XML_HEAD + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' + rdf('header') +
      '<rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description>' + rdf('section0') +
      '<rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description><rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description></rdf:RDF>',
    'Contents/content.hpf': XML_HEAD + `<opf:package ${SEED_NS} version="" unique-identifier="" id=""><opf:metadata><opf:title/><opf:language>ko</opf:language></opf:metadata>` +
      '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>' +
      '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>',
    'META-INF/container.xml': XML_HEAD + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>',
    'META-INF/manifest.xml': XML_HEAD + '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>',
  });
}
