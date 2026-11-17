// "Reports by activity type": each report is placed under ONE IIC activity type, from the words in its title.
// Types are listed in TYPES (display order). Matching tries MATCH_ORDER from the most specific
// (named days) to the most general, and the first type whose words appear in the title wins.
// To add a type or a word, edit TYPES (words are lower case; "&" in titles is read as "and").
(function () {
  // [type, specific words, general words]. Specific words are checked first across all types,
  // general words only if nothing specific matched.
  const TYPES = [
    ["Ideation / Idea Generation / Problem Solving Techniques", ["ideation", "idea generation", "ideathon", "hackathon", "problem solving", "problem-solving", "brainstorm"], ["idea", "hack"]],
    ["Design Thinking / Design Development / Prototyping", ["design thinking", "design development", "prototyp", "product design", "product development"], []],
    ["Innovation Promotion", ["innovation promotion"], ["innovation", "innovative", "innovator", "creativity", "invent"]],
    ["Business Model Canvas / Business Plan Development", ["business model", "bmc", "lean canvas", "canvas", "business plan", "b-plan", "bplan"], []],
    ["IPR Awareness Sessions", ["ipr", "patent", "copyright", "trademark", "trade mark", "intellectual property", "design registration", "geographical indication"], []],
    ["Angel Investors / Venture Capitalists for Funding of Start-Ups", ["angel", "venture capital", "investor", "funding", "fund raising", "fundraising", "seed fund", "investment"], []],
    ["Promotion of Start-Ups", ["incubat", "startup promotion", "start-up promotion"], ["startup", "start-up", "start up", "founder"]],
    ["Entrepreneurship Promotion / Entrepreneurs Talk Show", ["talk show", "e-cell", "ecell", "entrepreneurship promotion", "self employment", "self-employment"], ["entrepreneur", "msme"]],
    ["Independent Day", ["independence day", "independent day", "15th august", "august 15", "15 august"], []],
    ["Entrepreneurs Day", ["entrepreneurs day", "entrepreneur day", "entrepreneurship day"], []],
    ["National Education Day", ["education day"], []],
    ["National Innovation Day", ["innovation day"], []],
    ["National Science Day", ["science day"], []],
    ["National Energy Conservation Day", ["energy conservation"], []],
    ["National Pollution Control Day", ["pollution control", "pollution prevention"], []],
    ["National Technology Day", ["technology day"], []],
    ["National Youth Day", ["youth day"], []],
    ["World Creativity & Innovation Day", ["creativity and innovation day", "world creativity"], []],
    ["Women Day", ["women day", "womens day", "woman day", "international women"], []],
    ["World IPR Day", ["ipr day", "ip day", "intellectual property day"], []],
    ["Startup Day", ["startup day", "start-up day", "start up day"], []],
    ["World Environment Day", ["environment day"], []],
    ["Field Visit", ["field visit", "industrial visit", "industry visit", "exposure visit", "visit"], []]
  ];
  // specific words: named days first, then the rest
  const MATCH_ORDER = [
    "World Creativity & Innovation Day", "World IPR Day", "Startup Day", "Entrepreneurs Day", "National Innovation Day",
    "National Education Day", "National Science Day", "National Energy Conservation Day", "National Pollution Control Day",
    "National Technology Day", "National Youth Day", "Women Day", "World Environment Day", "Independent Day",
    "Field Visit", "Angel Investors / Venture Capitalists for Funding of Start-Ups", "IPR Awareness Sessions",
    "Business Model Canvas / Business Plan Development", "Design Thinking / Design Development / Prototyping",
    "Ideation / Idea Generation / Problem Solving Techniques", "Entrepreneurship Promotion / Entrepreneurs Talk Show",
    "Promotion of Start-Ups", "Innovation Promotion"
  ];
  // general words, if nothing specific matched
  const WEAK_ORDER = ["Promotion of Start-Ups", "Entrepreneurship Promotion / Entrepreneurs Talk Show",
    "Ideation / Idea Generation / Problem Solving Techniques", "Innovation Promotion"];
  const OTHER = "Other";
  const QS = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // titles are read in lower case, apostrophes dropped, "&" as "and", spaces tidied
  const norm = t => " " + String(t || "").toLowerCase().replace(/[’'`]/g, "").replace(/&/g, " and ").replace(/\s+/g, " ").trim();
  // a word must start a word: "visit" matches "visits", "prototyp" matches "prototyping", "ipr" does not match "surprise"
  const kwRe = kws => new RegExp("[^a-z0-9](" + kws.map(reEsc).join("|") + ")", "i");
  const RE = new Map(TYPES.filter(([, k]) => k.length).map(([n, k]) => [n, kwRe(k)]));
  const RE_WEAK = new Map(TYPES.filter(([, , w]) => w.length).map(([n, , w]) => [n, kwRe(w)]));

  function typeOf(title) {
    const t = norm(title);
    for (const n of MATCH_ORDER) if (RE.has(n) && RE.get(n).test(t)) return n;
    for (const n of WEAK_ORDER) if (RE_WEAK.has(n) && RE_WEAK.get(n).test(t)) return n;
    return OTHER;
  }

  let last = null, open = null, inited = false;
  const monthLabel = k => { const m = /^(\d{4})-(\d{2})$/.exec(k || ""); return m ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1] + " " + m[1] : ""; };
  const counted = r => r.submission === "Submitted" && r.verification !== "Rejected";

  function customRow(reps) {
    const q = ($("cat_search") ? $("cat_search").value : "").trim().toLowerCase();
    if (!q) return null;
    const words = q.split(",").map(w => w.trim().replace(/&/g, "and")).filter(Boolean);
    if (!words.length) return null;
    const re = kwRe(words), list = reps.filter(r => re.test(norm(r.title)));
    return { name: "“" + q + "”", kws: words, list, custom: true };
  }

  function rowsFor(state) {
    const reps = state.reports.filter(counted);
    const by = new Map([...TYPES.map(([n]) => [n, []]), [OTHER, []]]);
    reps.forEach(r => by.get(typeOf(r.title)).push(r));
    const rows = [...TYPES.map(([n, k, w]) => ({ name: n, kws: [...k, ...w], list: by.get(n) })), { name: OTHER, kws: [], list: by.get(OTHER), other: true }];
    const c = customRow(reps); if (c) rows.unshift(c);
    rows.forEach(x => { x.q = QS.map(q => x.list.filter(r => r.quarter === q).length); x.depts = new Set(x.list.map(r => r.type + "|" + r.dept)).size; });
    return { rows, total: reps.length };
  }

  function init() {
    inited = true;
    const toggle = tr => { open = open === tr.dataset.cat ? null : tr.dataset.cat; render(last); };
    $("cat_table").addEventListener("click", e => { const tr = e.target.closest("[data-cat]"); if (tr) toggle(tr); });
    $("cat_table").addEventListener("keydown", e => { const tr = e.target.closest("[data-cat]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(tr); } });
    $("cat_search").addEventListener("input", () => { open = null; render(last); });
    const hide = $("cat_hideZero"); if (hide) hide.addEventListener("change", () => render(last));
  }

  function hl(title, kws) {
    if (!kws.length) return esc(title);
    return esc(title).replace(new RegExp("(^|[^a-z0-9])(" + kws.map(k => reEsc(esc(k))).join("|") + ")", "ig"), "$1<mark>$2</mark>");
  }

  function render(state) {
    if (!state || !$("cat_table")) return;
    last = state; if (!inited) init();
    const { rows, total } = rowsFor(state);
    if (!total) { $("cat_table").innerHTML = '<div class="empty">Counts appear here once reports are submitted.</div>'; return; }
    const hideZero = $("cat_hideZero") && $("cat_hideZero").checked;
    const shown = rows.filter(x => x.custom || !hideZero || x.list.length);
    const sumQ = QS.map((_, i) => rows.filter(x => !x.custom).reduce((s, x) => s + x.q[i], 0));
    $("cat_table").innerHTML = `<table class="cattbl"><thead><tr><th class="n">#</th><th>Activity type</th><th class="n">Q1</th><th class="n">Q2</th><th class="n">Q3</th><th class="n">Q4</th><th class="n">Reports</th><th class="n">Departments</th></tr></thead><tbody>` +
      shown.map(x => {
        const isOpen = open === x.name, idx = x.custom ? "" : rows.filter(y => !y.custom).indexOf(x) + 1;
        let html = `<tr class="catrow${x.custom ? " custom" : ""}${x.other ? " other" : ""}${isOpen ? " open" : ""}${x.list.length ? "" : " zero"}" data-cat="${esc(x.name)}" tabindex="0" aria-expanded="${isOpen}" title="${x.kws.length ? "Title words: " + esc(x.kws.join(", ")) : "Titles that match no type"}">
          <td class="n">${idx}</td><td><span class="caret">${isOpen ? "▾" : "▸"}</span> <b>${esc(x.name)}</b></td>
          ${x.q.map(v => `<td class="n">${v}</td>`).join("")}<td class="n"><b>${x.list.length}</b></td><td class="n">${x.depts}</td></tr>`;
        if (isOpen) {
          html += `<tr class="catlist"><td colspan="8"><div class="hint" style="margin-bottom:6px">${x.kws.length ? "Title words: " + esc(x.kws.join(", ")) : "Reports whose titles match none of the types. Rename the title or ask to add a word."}</div>` + (x.list.length
            ? `<table><thead><tr><th>Aided/SF</th><th>Department</th><th>Quarter</th><th>Month</th><th>Report title</th><th>Verification</th></tr></thead><tbody>` +
              [...x.list].sort((a, b) => a.dept.localeCompare(b.dept) || (a.month || "").localeCompare(b.month || "")).map(r =>
                `<tr><td><span class="tag">${esc(r.type)}</span></td><td>${esc(r.dept)}</td><td>${esc(String(r.quarter).replace("Quarter ", "Q"))}</td><td style="white-space:nowrap">${esc(monthLabel(r.month) || "—")}</td><td>${hl(r.title, x.kws)}</td><td>${esc(r.verification)}</td></tr>`).join("") +
              "</tbody></table>"
            : '<span class="hint">No reports.</span>') + "</td></tr>";
        }
        return html;
      }).join("") +
      `<tr class="cattotal"><td></td><td><b>Total</b></td>${sumQ.map(v => `<td class="n"><b>${v}</b></td>`).join("")}<td class="n"><b>${total}</b></td><td class="n"><b>${new Set(state.reports.filter(counted).map(r => r.type + "|" + r.dept)).size}</b></td></tr>` +
      `</tbody></table><p class="hint" style="margin:8px 0 0">Each report is counted under one type (rejected reports are left out). Named days are checked first, so "National Innovation Day" counts as that day, not as Innovation Promotion.</p>`;
  }

  // rows for Excel / PDF (all types, including zeros, plus total)
  function exportRows(state) {
    const { rows, total } = rowsFor(state);
    const base = rows.filter(x => !x.custom);
    const out = base.map((x, i) => [i + 1, x.name, ...x.q, x.list.length, x.depts]);
    out.push(["", "Total", ...QS.map((_, i) => base.reduce((s, x) => s + x.q[i], 0)), total, new Set(state.reports.filter(counted).map(r => r.type + "|" + r.dept)).size]);
    return out;
  }
  function exportDetail(state) {
    const rows = [];
    rowsFor(state).rows.filter(x => !x.custom).forEach(x => x.list.forEach(r =>
      rows.push([x.name, r.type, r.dept, String(r.quarter).replace("Quarter ", "Q"), monthLabel(r.month), r.title, r.verification])));
    return rows;
  }

  window.IICCat = { render, exportRows, exportDetail, typeOf, HEAD: ["#", "Activity type", "Q1", "Q2", "Q3", "Q4", "Reports", "Departments"] };
})();
