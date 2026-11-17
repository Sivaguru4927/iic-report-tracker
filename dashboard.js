// Dashboard tab: activity counts (month / quarter / IIC year (Sep–Aug)), toppers and low performers.
// Each submitted report counts as one activity. Works on { depts, reports } from the tracker.
(function () {
  const ACAD_START = 8;            // IIC calendar year starts in September (0 = Jan … 8 = Sep)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const QS = ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byName = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" });

  const ayOf = d => d.getMonth() >= ACAD_START ? d.getFullYear() : d.getFullYear() - 1;
  const ayLabel = y => y + "–" + String((y + 1) % 100).padStart(2, "0");
  const monthsOf = y => Array.from({ length: 12 }, (_, i) => {
    const m = (ACAD_START + i) % 12, yr = y + (ACAD_START + i >= 12 ? 1 : 0);
    return { key: yr + "-" + m, y: yr, m, short: MONTHS[m], label: FULL[m] + " " + yr };
  });
  // the activity month chosen on the report; older reports without one use the submission date
  const dateOf = r => {
    const m = /^(\d{4})-(\d{2})$/.exec(r.month || "");
    return m ? new Date(+m[1], +m[2] - 1, 15) : new Date(r.created_at || r.createdAt || 0);
  };
  const keyOf = (type, name) => type + "|" + name;

  let last = null, period = "month", inited = false, selMonth = null, selQ = null;

  function counted(r, basis) {
    if (r.submission && r.submission !== "Submitted") return false;
    return basis === "verified" ? r.verification === "Verified" : r.verification !== "Rejected";
  }

  function init() {
    inited = true;
    document.querySelectorAll("#db_period button").forEach(b => b.addEventListener("click", () => {
      period = b.dataset.p;
      document.querySelectorAll("#db_period button").forEach(x => x.setAttribute("aria-pressed", x === b));
      render(last);
    }));
    $("db_months").addEventListener("click", e => {
      const b = e.target.closest("[data-mkey]"); if (!b) return;
      selMonth = b.dataset.mkey; render(last);
    });
    $("db_quarters").addEventListener("click", e => {
      const b = e.target.closest("[data-q]"); if (!b) return;
      selQ = b.dataset.q; render(last);
    });
    $("db_year").addEventListener("change", () => { selMonth = null; selQ = null; render(last); });
    $("db_month").addEventListener("change", e => { selMonth = e.target.value; render(last); });
    $("db_q").addEventListener("change", e => { selQ = e.target.value; render(last); });
    $("db_type").addEventListener("change", () => render(last));
    $("db_basis").addEventListener("change", () => render(last));
  }

  function render(state) {
    if (!state || !$("db_yearlabel") || !$("db_year")) return;
    last = state;
    if (!inited) init();

    const type = $("db_type").value, basis = $("db_basis").value;
    const all = state.reports.map(r => ({ ...r, d: dateOf(r) })).filter(r => !isNaN(r.d));
    const now = new Date();

    // year list: current IIC year plus any year with reports
    const ySel = $("db_year"), yPrev = ySel.value;
    const ys = [...new Set([ayOf(now), ...all.map(r => ayOf(r.d))])].sort((a, b) => b - a);
    ySel.innerHTML = ys.map(y => `<option value="${y}">${ayLabel(y)}</option>`).join("");
    ySel.value = ys.includes(+yPrev) ? yPrev : String(ayOf(now));
    const Y = +ySel.value;
    $("db_yearlabel").textContent = "IIC year " + ayLabel(Y);

    const months = monthsOf(Y);
    const nowKey = now.getFullYear() + "-" + now.getMonth();
    if (!months.some(m => m.key === selMonth)) selMonth = months.some(m => m.key === nowKey) ? nowKey : months[0].key;
    const M = months.find(m => m.key === selMonth);
    const mSel = $("db_month");
    mSel.innerHTML = months.map(m => `<option value="${m.key}">${m.label}</option>`).join("");
    mSel.value = selMonth;

    const reps = all.filter(r => (!type || r.type === type) && counted(r, basis));
    const yearReps = reps.filter(r => ayOf(r.d) === Y);
    const monthReps = yearReps.filter(r => r.d.getFullYear() === M.y && r.d.getMonth() === M.m);

    if (!QS.includes(selQ)) {
      const latest = [...yearReps].sort((a, b) => b.d - a.d)[0];
      selQ = latest ? latest.quarter : "Quarter 1";
    }
    const Q = selQ;
    $("db_q").value = Q;
    const qReps = yearReps.filter(r => r.quarter === Q);

    // departments (on record + any that reported)
    const depts = new Map();
    state.depts.filter(d => !type || d.type === type).forEach(d => depts.set(keyOf(d.type, d.name), { type: d.type, name: d.name }));
    reps.forEach(r => { const k = keyOf(r.type, r.dept); if (!depts.has(k)) depts.set(k, { type: r.type, name: r.dept }); });
    const countBy = list => { const c = new Map(); list.forEach(r => { const k = keyOf(r.type, r.dept); c.set(k, (c.get(k) || 0) + 1); }); return c; };
    const cM = countBy(monthReps), cQ = countBy(qReps), cY = countBy(yearReps);
    const lastDate = new Map(); yearReps.forEach(r => { const k = keyOf(r.type, r.dept); if (!lastDate.has(k) || r.d > lastDate.get(k)) lastDate.set(k, r.d); });
    const activeM = [...depts.keys()].filter(k => cM.get(k)).length;

    // tiles
    const basisWord = basis === "verified" ? "verified activities" : "activities";
    $("db_tiles").innerHTML = [
      [monthReps.length, M.label, basisWord],
      [qReps.length, Q + ", " + ayLabel(Y), basisWord],
      [yearReps.length, "IIC year " + ayLabel(Y), basisWord],
      [activeM + " / " + depts.size, M.label, "departments active"]
    ].map(([v, k, s]) => `<div class="tile"><div class="v">${v}</div><div class="k"><b>${esc(k)}</b><br>${esc(s)}</div></div>`).join("");

    // monthly bars
    const perMonth = months.map(m => yearReps.filter(r => r.d.getFullYear() === m.y && r.d.getMonth() === m.m).length);
    const maxM = Math.max(1, ...perMonth);
    $("db_months").innerHTML = months.map((m, i) => {
      const v = perMonth[i], h = v ? Math.max(4, Math.round(v / maxM * 100)) : 0, sel = m.key === M.key;
      return `<button type="button" class="bcol${sel ? " sel" : ""}" data-mkey="${m.key}" aria-label="${esc(m.label)}: ${v} ${basisWord}" data-tip="${esc(m.label)}: ${v}">
        <span class="bval">${v || ""}</span><span class="btrack"><span class="bfill" style="height:${h}%"></span></span><span class="blab">${m.short}</span></button>`;
    }).join("");

    // quarter bars
    const perQ = QS.map(q => yearReps.filter(r => r.quarter === q).length), maxQ = Math.max(1, ...perQ);
    $("db_quarters").innerHTML = QS.map((q, i) => `<button type="button" class="hrow${q === Q ? " sel" : ""}" data-q="${q}" aria-label="${q}: ${perQ[i]} ${basisWord}" data-tip="${q}: ${perQ[i]}">
      <span class="hlab">${q.replace("Quarter ", "Q")}</span>
      <span class="htrack"><span class="hfill" style="width:${perQ[i] ? Math.max(2, perQ[i] / maxQ * 100) : 0}%"></span></span>
      <span class="hval">${perQ[i]}</span></button>`).join("");

    // toppers / low performers
    const cP = period === "month" ? cM : period === "quarter" ? cQ : cY;
    const pLabel = period === "month" ? M.label : period === "quarter" ? Q + ", " + ayLabel(Y) : "IIC year " + ayLabel(Y);
    $("db_plabel").textContent = pLabel;
    const list = [...depts.entries()].map(([k, d]) => ({ k, ...d, n: cP.get(k) || 0 }));
    const top = list.filter(x => x.n > 0).sort((a, b) => b.n - a.n || byName(a.name, b.name)).slice(0, 5);
    const topKeys = new Set(top.map(x => x.k));
    const lowAll = list.filter(x => !topKeys.has(x.k)).sort((a, b) => a.n - b.n || byName(a.name, b.name));
    const low = lowAll.slice(0, 5);
    const zeros = lowAll.filter(x => x.n === 0).length;
    const maxT = Math.max(1, ...top.map(x => x.n));
    const item = (x, i, cls) => `<li class="${cls}"><span class="rk">${i + 1}</span><span class="who"><b>${esc(x.name)}</b> <span class="tag">${esc(x.type)}</span>
      <span class="mini"><span style="width:${x.n ? Math.max(3, x.n / maxT * 100) : 0}%"></span></span></span><span class="cnt">${x.n}</span></li>`;
    $("db_top").innerHTML = top.length ? top.map((x, i) => item(x, i, "top")).join("") : `<li class="none">No activities in ${esc(pLabel)} yet.</li>`;
    $("db_low").innerHTML = low.length ? low.map((x, i) => item(x, i, x.n ? "low" : "zero")).join("") +
      (zeros > low.filter(x => !x.n).length ? `<li class="none">+ ${zeros - low.filter(x => !x.n).length} more department(s) with no activities. See the ranking below.</li>` : "")
      : `<li class="none">No departments on record yet.</li>`;

    // ranking table
    const rows = [...depts.entries()].map(([k, d]) => ({ k, ...d, m: cM.get(k) || 0, q: cQ.get(k) || 0, y: cY.get(k) || 0, last: lastDate.get(k) }))
      .sort((a, b) => b.y - a.y || b.q - a.q || b.m - a.m || byName(a.name, b.name));
    let rank = 0, prev = null;
    rows.forEach((r, i) => { if (prev === null || r.y !== prev) rank = i + 1; r.rank = rank; prev = r.y; });
    const fmt = d => d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    $("db_rank").innerHTML = rows.length ? `<table><thead><tr><th class="n">Rank</th><th>Aided/SF</th><th>Department</th>
      <th class="n">${esc(M.short + " " + M.y)}</th><th class="n">${esc(Q.replace("Quarter ", "Q"))}</th><th class="n">${esc(ayLabel(Y))}</th><th>Last submitted</th><th>This month</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td class="n"><b>${r.y ? r.rank : "—"}</b></td><td><span class="tag">${esc(r.type)}</span></td><td>${esc(r.name)}</td>
        <td class="n">${r.m}</td><td class="n">${r.q}</td><td class="n"><b>${r.y}</b></td><td style="white-space:nowrap">${fmt(r.last)}</td>
        <td>${r.m ? '<span class="pill p-ok">Active</span>' : '<span class="pill p-bad">No activity</span>'}</td></tr>`).join("") + "</tbody></table>"
      : '<div class="empty">Add departments in Departments &amp; faculty to see the ranking.</div>';

    // IIC calendar, celebrations, NISP and NIRF
    if (window.IICFramework) IICFramework.render(state, { year: Y, type, basis, save: window.IICFwSave });
  }

  window.IICDash = { render };
})();
