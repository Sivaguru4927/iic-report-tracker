/* IIC Report Tracker — AI formatting agent for Word (.docx) reports, runs in the browser.
   Applies the PSGCAS house style before a report is uploaded:
   · Times New Roman everywhere · main headings 16 pt bold · subheadings 14 pt bold · body 12 pt regular, justified
   · letterhead colours from the sample report (07.10.2026 Awareness Workshop): college name navy #244061,
     "INSTITUTION'S INNOVATION COUNCIL" pink #FF0066, event title green #336600, detail labels Date/Time/Internal/
     External/Duration/Mode red #FF0000
   · PSGCAS logo (left) and IIC logo (right) beside the letterhead if the file doesn't already have them
   · consistent spacing, 0.75 in side margins, tables with a shaded repeating header row, oversized images scaled to fit
   Content is never changed: no words are added, removed or reworded.
   Needs JSZip (window.JSZip). Usage: IICFormat.format(fileOrArrayBuffer, { psg: Uint8Array, iic: Uint8Array }) → { blob, info } */
(function () {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const FONT = 'Times New Roman';
  const NAVY = '244061', PINK = 'FF0066', GREEN = '336600', RED = 'FF0000';
  const EMU = 914400;
  const NOF = { createFolders: false };      // Word dislikes folder entries in the zip

  const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof',
    'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText',
    'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
  const PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs',
    'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid',
    'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl',
    'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
  const STYLE_ORDER = ['name', 'aliases', 'basedOn', 'next', 'link', 'autoRedefine', 'hidden', 'uiPriority', 'semiHidden', 'unhideWhenUsed', 'qFormat', 'locked',
    'personal', 'personalCompose', 'personalReply', 'rsid', 'pPr', 'rPr', 'tblPr', 'trPr', 'tcPr', 'tblStylePr'];
  const TCPR_ORDER = ['cnfStyle', 'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'shd', 'noWrap', 'tcMar', 'textDirection', 'tcFitText', 'vAlign', 'hideMark'];

  // which paragraphs are what (matched on the paragraph text)
  const TITLE = [/^PSG COLLEGE OF ARTS/i];
  const CENTRE = [/^Centre for Innovation/i];
  const IICLINE = [/^INSTITUTION.S INNOVATION COUNCIL/i];
  const EVENT = [/^Title of the Event/i];
  const LETTERHEAD = [/^DEPARTMENT NAME/i, /^Programme Title/i];
  const MAIN = [/^([A-E]\.\s*)?Event Report\s*$/i, /^([A-E]\.\s*)?Outcome of the Activity/i, /^([A-E]\.\s*)?Supportive Documents/i,
    /^([A-E]\.\s*)?Three to four Geotagged/i, /^([A-E]\.\s*)?Social Media Link\s*$/i];
  const SUB = [/^Expert\/Speakers Details/i, /^Details of all the Experts/i, /^Objective(s)?( of the activity)?\s*:?/i, /^Benefits\s*:?\s*$/i,
    /^Brief Description of (the Event|activity)/i, /^Key Highlights( of the Program)?/i, /^Feedback(\s*\/\s*Reflection)?\s*:?\s*$/i,
    /^Organi[sz]ing Team Member Details/i, /^Permission Letter for the Event/i, /^Poster of the Event/i, /^Participant Attendance details/i,
    /^Photographs of the Event/i, /^Outcomes of the Activity/i, /^Key Topics Covered/i, /^Brief Description of the Resource Person/i];
  const DETAILS = [/^Date\s/i, /^Time\s/i, /^Duration/i, /^Activity Category/i, /^Theme( of the Event)?\s*:/i, /^Activity (Lead|Led) By/i, /^Level of the Activity/i, /^Mode\s*:/i];
  const LABEL = [/^Participant Feedback \d/i];
  const DETAIL_RED = 'Date|Time|Internal|External|Duration|Mode';
  const DETAIL_BLACK = 'Activity Category|Theme of the Event|Theme|Activity Lead By|Activity Led by|Level of the Activity';
  const match = (pats, t) => pats.some(re => re.test(t.trim()));

  /* ---------- small DOM helpers (WordprocessingML namespace) ---------- */
  const kids = (el, tag) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.namespaceURI === W && (!tag || n.localName === tag));
  const first = (el, tag) => kids(el, tag)[0] || null;
  const all = (el, tag) => Array.from(el.getElementsByTagNameNS(W, tag));
  const mk = (doc, tag, attrs) => { const e = doc.createElementNS(W, 'w:' + tag); for (const k in (attrs || {})) e.setAttributeNS(W, 'w:' + k, String(attrs[k])); return e; };
  const val = (el, k) => el.getAttributeNS(W, k);
  function child(el, tag, atStart) {
    let c = first(el, tag);
    if (!c) { c = mk(el.ownerDocument, tag); if (atStart && el.firstChild) el.insertBefore(c, el.firstChild); else el.appendChild(c); }
    return c;
  }
  const removeAll = (el, tag) => kids(el, tag).forEach(c => el.removeChild(c));
  function order(el, seq) {
    const list = Array.from(el.childNodes).filter(n => n.nodeType === 1);
    const idx = n => { const i = seq.indexOf(n.localName); return i < 0 ? seq.length : i; };
    list.sort((a, b) => idx(a) - idx(b)).forEach(n => el.appendChild(n));
  }
  function setFonts(rpr) {
    removeAll(rpr, 'rFonts');
    const f = mk(rpr.ownerDocument, 'rFonts', { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: FONT });
    rpr.insertBefore(f, rpr.firstChild);
  }
  function setSize(rpr, half) { removeAll(rpr, 'sz'); removeAll(rpr, 'szCs'); rpr.appendChild(mk(rpr.ownerDocument, 'sz', { val: half })); rpr.appendChild(mk(rpr.ownerDocument, 'szCs', { val: half })); }
  function bold(rpr, on = true) { removeAll(rpr, 'b'); removeAll(rpr, 'bCs'); if (on) { rpr.appendChild(mk(rpr.ownerDocument, 'b')); rpr.appendChild(mk(rpr.ownerDocument, 'bCs')); } }
  function colour(rpr, hex) { removeAll(rpr, 'color'); if (hex) rpr.appendChild(mk(rpr.ownerDocument, 'color', { val: hex })); }
  const text = p => all(p, 't').map(t => t.textContent).join('');
  const hasImg = p => all(p, 'drawing').length > 0 || all(p, 'pict').length > 0;
  const inTable = p => { for (let a = p.parentNode; a; a = a.parentNode) if (a.localName === 'tc' && a.namespaceURI === W) return true; return false; };
  const inLink = r => { for (let a = r.parentNode; a; a = a.parentNode) if (a.localName === 'hyperlink' && a.namespaceURI === W) return true; return false; };
  const parse = s => new DOMParser().parseFromString(s, 'application/xml');
  const ser = d => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
  const preserve = t => t.setAttributeNS(XMLNS, 'xml:space', 'preserve');

  /* ---------- styles.xml ---------- */
  function formatStyles(sd) {
    const root = sd.documentElement;
    all(root, 'rPr').forEach(rpr => { if (first(rpr, 'rFonts')) setFonts(rpr); removeAll(rpr, 'color'); });
    const dd = root.getElementsByTagNameNS(W, 'rPrDefault')[0];
    if (dd) { const rpr = child(dd, 'rPr'); setFonts(rpr); setSize(rpr, 24); order(rpr, RPR_ORDER); }
    const pd = root.getElementsByTagNameNS(W, 'pPrDefault')[0];
    if (pd) { const ppr = child(pd, 'pPr'); removeAll(ppr, 'spacing'); ppr.appendChild(mk(sd, 'spacing', { after: 120, line: 276, lineRule: 'auto' })); order(ppr, PPR_ORDER); }
    kids(root, 'style').forEach(st => {
      const sid = val(st, 'styleId');
      const rpr = child(st, 'rPr'); setFonts(rpr);
      setSize(rpr, { Title: 32, Heading1: 32, Heading2: 28, Heading3: 28 }[sid] || 24);
      if (['BodyText', 'BodyTextChar', 'Normal', 'ListParagraph', 'TableParagraph'].includes(sid)) bold(rpr, false);
      order(rpr, RPR_ORDER); order(st, STYLE_ORDER);
    });
  }

  /* ---------- document.xml ---------- */
  function formatDocument(dd) {
    const body = dd.getElementsByTagNameNS(W, 'body')[0];
    const info = { removed: 0, scaled: 0 };
    let afterIic = false, eventDone = false;     // the first heading line after "INSTITUTION'S INNOVATION COUNCIL" is the event title
    const TEXT_W = 7.0 * EMU, TEXT_H = 7.9 * EMU;
    for (const p of all(body, 'p')) {
      if (!p.parentNode) continue;
      const t = text(p);
      if (!inTable(p) && !t.trim() && !hasImg(p) && !all(p, 'sectPr').length && !all(p, 'br').length) { p.parentNode.removeChild(p); info.removed++; continue; }
      const ppr = child(p, 'pPr', true);
      const sty = first(ppr, 'pStyle'), sid = sty ? val(sty, 'val') : '';
      let kind = 'body';
      if (inTable(p)) kind = 'cell';
      else if (match(TITLE, t)) kind = 'title'; else if (match(CENTRE, t)) kind = 'centre'; else if (match(IICLINE, t)) kind = 'iicline';
      else if (hasImg(p) && !t.trim()) kind = 'image'; else if (sid === 'Caption') kind = 'caption';
      else if (match(EVENT, t)) kind = 'event'; else if (match(LETTERHEAD, t)) kind = 'letterhead'; else if (match(MAIN, t)) kind = 'main';
      else if (match(SUB, t)) kind = 'sub'; else if (match(DETAILS, t)) kind = 'details'; else if (match(LABEL, t)) kind = 'label';
      else if (hasImg(p)) kind = 'image';
      if (kind === 'iicline') afterIic = true;
      else if (afterIic && !eventDone && t.trim() && kind === 'body') kind = 'event';
      if (kind === 'event') eventDone = true;
      if (kind === 'details' || kind === 'main') afterIic = false;
      const HEAD = ['title', 'centre', 'iicline', 'event', 'letterhead'];
      const size = { title: 26, centre: 26, iicline: 26, event: 32, letterhead: 28, main: 32, sub: 28 }[kind] || 24;
      const col = { title: NAVY, iicline: PINK, event: GREEN }[kind] || null;
      const isBold = HEAD.includes(kind) || ['main', 'sub', 'label'].includes(kind);
      removeAll(ppr, 'jc');
      ppr.appendChild(mk(dd, 'jc', { val: HEAD.includes(kind) || kind === 'image' || kind === 'caption' ? 'center' : (['main', 'sub', 'details', 'cell'].includes(kind) ? 'left' : 'both') }));
      if (HEAD.includes(kind) && sty && /^Heading/.test(sid)) ppr.removeChild(sty);
      removeAll(ppr, 'spacing');
      const [before, after] = { title: [0, 20], centre: [0, 20], iicline: [0, 160], event: [120, 200], letterhead: [0, 40], main: [240, 120], sub: [180, 80],
        image: [120, 60], caption: [0, 160], cell: [0, 0], details: [0, 60] }[kind] || [0, 120];
      ppr.appendChild(mk(dd, 'spacing', { before, after, line: kind === 'cell' ? 240 : 276, lineRule: 'auto' }));
      if ((isBold || (kind === 'image' && p.nextSibling)) && !first(ppr, 'keepNext')) ppr.appendChild(mk(dd, 'keepNext'));
      const prpr = first(ppr, 'rPr');
      if (prpr) { setFonts(prpr); setSize(prpr, size); colour(prpr, col); order(prpr, RPR_ORDER); }
      const runs = all(p, 'r');
      runs.forEach(r => {
        const rpr = child(r, 'rPr', true);
        setFonts(rpr); setSize(rpr, size);
        if (!inLink(r)) colour(rpr, col);
        removeAll(rpr, 'highlight');
        if (isBold) bold(rpr);
        if (kind === 'caption' && !first(rpr, 'i')) rpr.appendChild(mk(dd, 'i'));
        order(rpr, RPR_ORDER);
      });
      if (kind === 'details') styleDetails(p, dd);
      if (kind === 'body') {   // body text is regular: drop bold when the whole paragraph was bolded
        const tr = runs.filter(r => all(r, 't').map(x => x.textContent).join('').trim());
        if (tr.length && tr.every(r => { const rp = first(r, 'rPr'); return rp && first(rp, 'b') && val(first(rp, 'b'), 'val') !== '0'; }))
          tr.forEach(r => bold(first(r, 'rPr'), false));
      }
      if (['sub', 'title', 'letterhead', 'centre', 'iicline', 'event'].includes(kind)) removeAll(ppr, 'ind');
      if (kind === 'main') kids(ppr, 'ind').forEach(e => { e.removeAttributeNS(W, 'right'); e.removeAttributeNS(W, 'end'); });
      if (kind === 'details') { removeAll(ppr, 'ind'); ppr.appendChild(mk(dd, 'ind', { left: 0, right: 0 })); }
      if (kind === 'details' || kind === 'sub') {     // two-column lines lined up with spaces → one tab + fixed tab stops
        const ts = all(p, 't');
        const x = ts.find(n => / {3,}/.test(n.textContent));
        if (x) {
          const parts = x.textContent.split(/ {3,}/); const head = parts.shift(), tail = parts.join(' ');
          x.textContent = head.replace(/\s+$/, ''); preserve(x);
          const tab = mk(dd, 'tab'); x.parentNode.insertBefore(tab, x.nextSibling);
          const t2 = mk(dd, 't'); t2.textContent = tail.replace(/^\s+/, ''); preserve(t2); x.parentNode.insertBefore(t2, tab.nextSibling);
          removeAll(ppr, 'tabs'); const tabs = mk(dd, 'tabs');
          [1440, 3960].forEach(pos => tabs.appendChild(mk(dd, 'tab', { val: 'left', pos })));
          ppr.appendChild(tabs);
        }
        const last = all(p, 't').pop(); if (last) last.textContent = last.textContent.replace(/ +$/, '');
      }
      if (['body', 'label', 'caption', 'sub', 'main'].includes(kind)) {   // tidy double spaces in running text
        const ts = all(p, 't');
        ts.forEach(x => { x.textContent = x.textContent.replace(/(\S) {2,}(?=\S)/g, '$1 '); });
        if (ts.length) ts[0].textContent = ts[0].textContent.replace(/^\s+/, '');
        if (ts.length && (kind === 'sub' || kind === 'main')) ts[ts.length - 1].textContent = ts[ts.length - 1].textContent.replace(/\s+$/, '');
      }
      order(ppr, PPR_ORDER);
      // images bigger than the page area: scale down, keep proportions
      Array.from(p.getElementsByTagNameNS(WP, 'extent')).forEach(ext => {
        const cx = +ext.getAttribute('cx'), cy = +ext.getAttribute('cy'); if (!cx || !cy) return;
        const f = Math.min(1, TEXT_W / cx, TEXT_H / cy);
        if (f < 1) {
          const ncx = Math.floor(cx * f), ncy = Math.floor(cy * f);
          ext.setAttribute('cx', ncx); ext.setAttribute('cy', ncy); info.scaled++;
          Array.from(ext.parentNode.getElementsByTagNameNS(A, 'ext')).forEach(a => { if (+a.getAttribute('cx') === cx) { a.setAttribute('cx', ncx); a.setAttribute('cy', ncy); } });
        }
      });
    }
    // a heading stranded between two full-page images starts on a new page
    const ps = kids(body, 'p');
    for (let i = 1; i < ps.length - 1; i++) {
      const t = text(ps[i]);
      if (t.trim() && match(SUB.concat(MAIN), t) && hasImg(ps[i + 1]) && hasImg(ps[i - 1])) {
        const ppr = child(ps[i], 'pPr', true); if (!first(ppr, 'pageBreakBefore')) ppr.appendChild(mk(dd, 'pageBreakBefore')); order(ppr, PPR_ORDER);
      }
    }
    // tables: shaded header row that repeats on new pages; rows don't split
    all(body, 'tbl').forEach(tbl => {
      const rows = kids(tbl, 'tr'); if (!rows.length) return;
      const trpr = child(rows[0], 'trPr', true); if (!first(trpr, 'tblHeader')) trpr.appendChild(mk(dd, 'tblHeader'));
      kids(rows[0], 'tc').forEach(tc => {
        const tcpr = child(tc, 'tcPr', true); removeAll(tcpr, 'shd'); tcpr.appendChild(mk(dd, 'shd', { val: 'clear', color: 'auto', fill: 'E7ECF4' })); order(tcpr, TCPR_ORDER);
        all(tc, 'r').forEach(r => { const rpr = child(r, 'rPr', true); bold(rpr); order(rpr, RPR_ORDER); });
      });
      rows.slice(1).forEach(r => { const trpr = child(r, 'trPr', true); if (!first(trpr, 'cantSplit')) trpr.appendChild(mk(dd, 'cantSplit')); });
    });
    // margins as in the sample report
    all(body, 'pgMar').forEach(pm => {
      [['left', 1080], ['right', 1080], ['top', 1008], ['bottom', 720], ['header', 567], ['footer', 567]].forEach(([k, v]) => pm.setAttributeNS(W, 'w:' + k, v));
    });
    return info;
  }

  // Date / Time / Internal / External / Duration / Mode labels in red bold; Activity Category / Theme / Lead By / Level labels in black bold
  function styleDetails(p, dd) {
    all(p, 'r').forEach(r => {             // one content element per run
      const content = Array.from(r.childNodes).filter(n => n.nodeType === 1 && n.localName !== 'rPr');
      let after = r;
      content.slice(1).forEach(c => {
        const r2 = mk(dd, 'r'); const rp = first(r, 'rPr'); if (rp) r2.appendChild(rp.cloneNode(true));
        r.removeChild(c); r2.appendChild(c); after.parentNode.insertBefore(r2, after.nextSibling); after = r2;
      });
    });
    const piece = r => { const c = Array.from(r.childNodes).find(n => n.nodeType === 1 && n.localName !== 'rPr'); return !c ? null : c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : ''; };
    const full = all(p, 'r').map(r => piece(r) || '').join('');
    const LBL = new RegExp('(' + DETAIL_BLACK + '|' + DETAIL_RED + ')[ \\t]*:', 'gi');
    const spans = []; let m;
    while ((m = LBL.exec(full))) spans.push([m.index, m.index + m[0].length, 'label', new RegExp('^(' + DETAIL_RED + ')$', 'i').test(m[1])]);
    if (!spans.length) return;
    const vals = spans.map((s, i) => [s[1], i + 1 < spans.length ? spans[i + 1][0] : full.length, 'value', s[3] && !/^Mode/i.test(full.slice(s[0], s[1]))]);
    const cuts = Array.from(new Set(spans.concat(vals).flatMap(s => [s[0], s[1]]))).sort((a, b) => a - b);
    let pos = 0;
    all(p, 'r').forEach(r => {
      const t = piece(r); if (t === null) return;
      const tn = first(r, 't'); const inner = cuts.filter(c => c > pos && c < pos + t.length).map(c => c - pos);
      if (tn && inner.length) {
        const bounds = [0].concat(inner, [t.length]); let prev = r;
        tn.textContent = t.slice(bounds[0], bounds[1]); preserve(tn);
        for (let i = 1; i < bounds.length - 1; i++) {
          const r2 = r.cloneNode(true); const t2 = first(r2, 't'); t2.textContent = t.slice(bounds[i], bounds[i + 1]); preserve(t2);
          prev.parentNode.insertBefore(r2, prev.nextSibling); prev = r2;
        }
      }
      pos += t.length;
    });
    pos = 0;
    all(p, 'r').forEach(r => {
      const t = piece(r); if (t === null) return;
      const mid = pos + t.length / 2;
      const hit = spans.concat(vals).find(s => s[0] <= mid && mid < s[1]);
      if (hit && t.trim()) {
        const rp = child(r, 'rPr', true);
        if (hit[2] === 'label') { bold(rp); colour(rp, hit[3] ? RED : null); } else { bold(rp, hit[3]); colour(rp, null); }
        order(rp, RPR_ORDER);
      }
      pos += t.length;
    });
  }

  /* ---------- logos beside the letterhead ---------- */
  const sameBytes = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  async function imgSize(bytes, mime) {
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
    const s = { w: bmp.width, h: bmp.height }; if (bmp.close) bmp.close(); return s;
  }
  async function addLogos(zip, dd, logos) {
    if (!logos || !logos.psg || !logos.iic) return [];
    const relsPath = 'word/_rels/document.xml.rels';
    const rels = parse(await zip.file(relsPath).async('string'));
    const relList = Array.from(rels.documentElement.childNodes).filter(n => n.nodeType === 1);
    const target = {}; relList.forEach(r => { target[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const top = [];
    for (const r of relList) {                         // images in the page header
      if (!/\/header$/.test(r.getAttribute('Type') || '')) continue;
      const hp = 'word/' + r.getAttribute('Target'), hr = 'word/_rels/' + r.getAttribute('Target').split('/').pop() + '.rels';
      if (!zip.file(hp) || !zip.file(hr)) continue;
      const hx = await zip.file(hp).async('string'), hrels = await zip.file(hr).async('string');
      const map = {}; hrels.replace(/Id="([^"]+)"[^>]*Target="([^"]+)"/g, (_, i, t) => { map[i] = t; });
      (hx.match(/r:embed="([^"]+)"/g) || []).forEach(e => { const id = e.slice(9, -1); if (map[id]) top.push('word/' + map[id].replace(/^\.\//, '')); });
    }
    const body = dd.getElementsByTagNameNS(W, 'body')[0];
    for (const p of kids(body, 'p').slice(0, 8)) {      // images at the top of the first page
      if (/Title of the Event|^\s*Date\b/i.test(text(p))) break;
      Array.from(p.getElementsByTagNameNS(A, 'blip')).forEach(b => { const id = b.getAttributeNS(R, 'embed'); if (target[id]) top.push('word/' + target[id].replace(/^\.\//, '')); });
    }
    const topBytes = await Promise.all(top.filter(f => zip.file(f)).map(f => zip.file(f).async('uint8array')));
    let havePsg = topBytes.some(b => sameBytes(b, logos.psg)), haveIic = topBytes.some(b => sameBytes(b, logos.iic));
    if (top.length >= 2) havePsg = haveIic = true;   // two images already at the very top: treat them as the two logos (other versions of them)
    const need = []; if (!havePsg) need.push('psg'); if (!haveIic) need.push('iic');
    if (!need.length) return [];
    // media, relationships, content types
    let n = 1; relList.forEach(r => { const k = +(String(r.getAttribute('Id')).match(/\d+/) || [0])[0]; if (k >= n) n = k + 1; });
    const addRel = name => {
      const id = 'rIdLogo' + (n++);
      const el = rels.createElementNS(rels.documentElement.namespaceURI, 'Relationship');
      el.setAttribute('Id', id); el.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'); el.setAttribute('Target', 'media/' + name);
      rels.documentElement.appendChild(el); return id;
    };
    let ct = await zip.file('[Content_Types].xml').async('string');
    [['png', 'image/png'], ['jpeg', 'image/jpeg']].forEach(([e, m]) => { if (!new RegExp('Extension="' + e + '"', 'i').test(ct)) ct = ct.replace('<Default ', '<Default Extension="' + e + '" ContentType="' + m + '"/><Default '); });
    zip.file('[Content_Types].xml', ct, NOF);
    const sect = body.getElementsByTagNameNS(W, 'sectPr')[0];
    const pgw = +val(first(sect, 'pgSz'), 'w'), mar = first(sect, 'pgMar');
    const tw = (pgw - +val(mar, 'left') - +val(mar, 'right')) * 635;
    const anchor = async (rid, bytes, mime, hIn, side, vOffIn, pid, name) => {
      const s = await imgSize(bytes, mime); const cy = Math.round(hIn * EMU), cx = Math.round(cy * s.w / s.h);
      const hpos = side === 'left' ? '<wp:align>left</wp:align>' : '<wp:posOffset>' + (tw - cx + Math.round(0.25 * EMU)) + '</wp:posOffset>';
      const xml = '<w:r xmlns:w="' + W + '"><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor xmlns:wp="' + WP + '" distT="0" distB="0" distL="114300" distR="114300" simplePos="0" ' +
        'relativeHeight="' + (251660000 + pid) + '" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>' +
        '<wp:positionH relativeFrom="margin">' + hpos + '</wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>' + Math.round(vOffIn * EMU) + '</wp:posOffset></wp:positionV>' +
        '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="' + pid + '" name="' + name + '"/>' +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="' + A + '" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
        '<a:graphic xmlns:a="' + A + '"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + pid + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip xmlns:r="' + R + '" r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
        '</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>';
      return dd.importNode(parse(xml).documentElement, true);
    };
    const firstP = kids(body, 'p').find(p => text(p).trim()) || kids(body, 'p')[0];
    const ppr = first(firstP, 'pPr'); const at = ppr ? ppr.nextSibling : firstP.firstChild;
    if (need.includes('psg')) { zip.file('word/media/logo_psgcas.jpeg', logos.psg, NOF); firstP.insertBefore(await anchor(addRel('logo_psgcas.jpeg'), logos.psg, 'image/jpeg', 0.85, 'left', -0.10, 9001, 'PSGCAS logo'), at); }
    if (need.includes('iic')) { zip.file('word/media/logo_iic.png', logos.iic, NOF); firstP.insertBefore(await anchor(addRel('logo_iic.png'), logos.iic, 'image/png', 0.47, 'right', -0.04, 9002, 'IIC logo'), at); }
    zip.file(relsPath, ser(rels), NOF);
    return need;
  }

  // logos are taken from the IIC report template (word/media/image1.png = IIC, image2.jpeg = PSGCAS)
  async function logosFromTemplate(templateBytes) {
    const z = await JSZip.loadAsync(templateBytes);
    const iic = z.file('word/media/image1.png'), psg = z.file('word/media/image2.jpeg');
    return iic && psg ? { iic: await iic.async('uint8array'), psg: await psg.async('uint8array') } : null;
  }

  async function format(input, logos) {
    if (!window.JSZip) throw new Error('JSZip is not loaded');
    const zip = await JSZip.loadAsync(input instanceof Blob ? await input.arrayBuffer() : input, { createFolders: false });
    const docFile = zip.file('word/document.xml'); if (!docFile) throw new Error('Not a Word (.docx) file');
    const dd = parse(await docFile.async('string'));
    if (dd.getElementsByTagName('parsererror').length) throw new Error('Could not read the document');
    if (zip.file('word/styles.xml')) { const sd = parse(await zip.file('word/styles.xml').async('string')); formatStyles(sd); zip.file('word/styles.xml', ser(sd), NOF); }
    const info = formatDocument(dd);
    info.logosAdded = await addLogos(zip, dd, logos);
    zip.file('word/document.xml', ser(dd), NOF);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return { blob, info };
  }

  window.IICFormat = { format, logosFromTemplate };
})();
