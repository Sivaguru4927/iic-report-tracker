// Coordinator tracker: sign in, verify reports, summary, departments
const THANKS = "Thanks for Submission";
(function () {
  const { $, esc, sb, byName, QS, VERS } = IIC;
  if (!IIC.configured) { IIC.setupNotice(document.querySelector(".wrap")); return; }

  const state = { depts: [], reports: [] };
  let channel = null, repDeferred = false;

  /* ---------- sign in ---------- */
  async function onSession(session) {
    if (!session) { showLogin(); return; }
    const { data: ok, error } = await sb.rpc("is_admin");
    if (error) {
      window.IICShowProblem("The database isn't fully set up",
        "Supabase answered: " + (error.message || "unknown error") + ". Run supabase-setup.sql in Supabase → SQL Editor, then reload this page.");
      return;
    }
    if (!ok) {
      await sb.auth.signOut();
      showLogin("This account isn't on the coordinator list. Ask the CII&E office to add your email.");
      return;
    }
    $("who").textContent = session.user.email;
    $("loginArea").hidden = true; $("adminArea").hidden = false; $("userbar").hidden = false;
    await Promise.all([loadDepts(), loadReports(), loadQueries(), loadCompliance()]);
    subscribe();
  }
  function showLogin(err) {
    $("adminArea").hidden = true; $("userbar").hidden = true; $("loginArea").hidden = false;
    const m = $("l_msg"); m.className = err ? "msg err" : "msg"; m.textContent = err || "";
    if (channel) { sb.removeChannel(channel); channel = null; }
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const m = $("l_msg"), email = $("l_email").value.trim(), password = $("l_pass").value;
    if (!email || !password) { m.className = "msg err"; m.textContent = "Enter your email and password."; return; }
    $("l_btn").disabled = true; m.className = "msg"; m.textContent = "Signing in…";
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    $("l_btn").disabled = false;
    if (error) { m.className = "msg err"; m.textContent = /Invalid login/i.test(error.message) ? "Email or password is incorrect." : IIC.friendlyError(error); return; }
    $("l_pass").value = "";
    onSession(data.session);
  });
  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); showLogin(); });

  /* ---------- data ---------- */
  async function loadDepts() {
    const { data, error } = await sb.from("departments").select("*");
    if (!error) state.depts = data || [];
    renderDepts(); renderSummary();
  }
  async function loadReports() {
    const { data, error } = await sb.from("reports").select("*").order("created_at", { ascending: false });
    if (error) { $("repTable").innerHTML = '<div class="empty">Couldn\'t load reports. ' + esc(IIC.friendlyError(error)) + "</div>"; return; }
    state.reports = data || [];
    renderReports(); renderSummary(); renderDepts();
  }
  let reloadTimer = null;
  function subscribe() {
    if (channel) return;
    channel = sb.channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        clearTimeout(reloadTimer); reloadTimer = setTimeout(loadReports, 600);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "queries" }, () => {
        clearTimeout(qTimer); qTimer = setTimeout(loadQueries, 600);
      })
      .subscribe();
  }
  $("refresh").addEventListener("click", () => { loadReports(); loadDepts(); loadQueries(); });

  /* ---------- queries ---------- */
  let qTimer = null, qReady = true, qDeferred = false;
  state.queries = [];
  const Q_STATUSES = ["Open", "In Progress", "Resolved"];
  const qCls = s => s === "Resolved" ? "ok" : s === "In Progress" ? "warn" : "bad";
  // NISP / NIRF status (Dashboard)
  state.compliance = {};
  async function loadCompliance() {
    const { data, error } = await sb.from("compliance").select("*");
    if (error) { window.IICFwSave = null; return; }   // table not installed yet: shown read-only
    state.compliance = Object.fromEntries((data || []).map(x => [x.id, x]));
    window.IICFwSave = async (id, row) => {
      const { error: e } = await sb.from("compliance").upsert({ id, ...row, updated_at: new Date().toISOString() });
      if (e) throw new Error(/target/.test(e.message || "") ? "The Target month column isn't installed yet. Run supabase-update-dashboard.sql in Supabase." : /compliance/.test(e.message || "") ? "The NISP / NIRF table isn't installed yet. Run supabase-update-dashboard.sql in Supabase." : IIC.friendlyError(e));
      state.compliance[id] = { id, ...row, updated_at: new Date().toISOString() };
      renderSummary();
    };
    renderSummary();
  }
  async function loadQueries() {
    const { data, error } = await sb.from("queries").select("*").order("created_at", { ascending: false });
    if (error) {
      qReady = false;
      $("qTable").innerHTML = /relation .*queries|does not exist|schema cache/i.test(error.message || "")
        ? '<div class="empty">The Queries feature isn\'t installed yet. Run <b>supabase-update-queries-tab.sql</b> in Supabase, then reload.</div>'
        : '<div class="empty">Couldn\'t load queries. ' + esc(IIC.friendlyError(error)) + "</div>";
      return;
    }
    qReady = true; state.queries = data || []; renderQueries();
  }
  function filteredQueries() {
    const st = $("q_status").value, t = $("q_type").value, k = $("q_kind").value;
    return state.queries.filter(q => (st === "open" ? q.status !== "Resolved" : !st || q.status === st) && (!t || q.type === t) &&
      (!k || (k === "none" ? !q.report_id : !!q.report_id)));
  }
  function renderQueries() {
    const open = state.queries.filter(q => q.status !== "Resolved").length;
    $("qBadge").hidden = !open; $("qBadge").textContent = open;
    if (!qReady) return;
    const tbl = $("qTable");
    if (tbl.contains(document.activeElement) && document.activeElement.matches("textarea,select")) { qDeferred = true; return; }
    qDeferred = false;
    const list = filteredQueries();
    if (!state.queries.length) { tbl.innerHTML = '<div class="empty">No queries yet. They appear here when a department writes in field 10 of the submission page.</div>'; return; }
    if (!list.length) { tbl.innerHTML = '<div class="empty">No queries match these filters.</div>'; return; }
    tbl.innerHTML = `<p class="hint" style="margin-bottom:8px">${list.length} quer${list.length > 1 ? "ies" : "y"}</p><table class="rep"><thead><tr><th>Received</th><th>Department</th><th>Faculty</th><th>Period</th><th>Report</th><th>Query</th><th>Status</th><th>Reply</th><th></th></tr></thead><tbody>` +
      list.map(q => `<tr><td style="white-space:nowrap">${IIC.day(q.created_at)}</td><td style="min-width:120px">${esc(q.dept)}<div><span class="tag">${esc(q.type)}</span></div></td>
        <td style="min-width:140px">${esc(q.faculty)}<div class="hint" style="overflow-wrap:anywhere">${esc(q.mobile || "")}${q.email ? "<br>" + esc(q.email) : ""}</div></td>
        <td style="white-space:nowrap">${esc(IIC.qShort(q.quarter))}<div class="hint">${esc(IIC.monthLabel(q.month) || "")}</div></td>
        <td style="min-width:110px">${q.report_id ? '<span class="pill p-ok">Submitted</span>' + (q.title ? `<div class="hint">${esc(q.title)}</div>` : "") : '<span class="pill p-bad">Not submitted</span>' + (q.title ? `<div class="hint">${esc(q.title)}</div>` : "")}</td>
        <td style="min-width:180px"><div class="query">${esc(q.query)}</div></td>
        <td><select class="vsel v-${qCls(q.status)}" style="min-width:120px" data-qstatus="${esc(q.id)}" aria-label="Status">${Q_STATUSES.map(s => `<option${s === q.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
        <td><textarea class="rem" style="min-width:170px" rows="2" maxlength="1000" data-qreply="${esc(q.id)}" aria-label="Reply" placeholder="Type your reply">${esc(q.reply)}</textarea></td>
        <td><button class="btn danger small" data-del-query="${esc(q.id)}">Delete</button></td></tr>`).join("") + "</tbody></table>";
  }
  ["q_status", "q_type", "q_kind"].forEach(id => $(id).addEventListener("change", renderQueries));
  async function patchQuery(id, fields, el) {
    const m = $("qMsg"), q = state.queries.find(x => x.id === id); if (!q) return;
    m.className = "msg"; m.textContent = "Saving…";
    const { error } = await sb.from("queries").update(fields).eq("id", id);
    if (error) { m.className = "msg err"; m.textContent = IIC.friendlyError(error); if (el) el.value = fields.status !== undefined ? q.status : q.reply; return; }
    Object.assign(q, fields);
    m.className = "msg ok";
    m.textContent = fields.status === "Resolved" ? "Marked Resolved. " + q.faculty + " will get your reply by email." : "Saved: " + q.dept + " · " + q.faculty;
    renderQueries();
  }
  $("qTable").addEventListener("change", e => {
    const s = e.target.closest("[data-qstatus]");
    if (s) {
      const q = state.queries.find(x => x.id === s.dataset.qstatus);
      if (s.value === "Resolved" && q && !q.reply.trim() && !$("qTable").querySelector(`[data-qreply="${q.id}"]`).value.trim()) {
        $("qMsg").className = "msg err"; $("qMsg").textContent = "Type a reply before marking it Resolved, so the faculty member knows the answer.";
        s.value = q.status; return;
      }
      s.className = "vsel v-" + qCls(s.value); patchQuery(s.dataset.qstatus, { status: s.value }, s); return;
    }
    const t = e.target.closest("[data-qreply]");
    if (t) { const q = state.queries.find(x => x.id === t.dataset.qreply), v = t.value.trim(); if (q && v !== (q.reply || "")) patchQuery(q.id, { reply: v }, t); }
  });
  $("qTable").addEventListener("focusout", () => setTimeout(() => { if (qDeferred && !$("qTable").contains(document.activeElement)) renderQueries(); }, 0));
  async function deleteQuery(id) {
    const { error } = await sb.from("queries").delete().eq("id", id);
    if (error) { $("qMsg").className = "msg err"; $("qMsg").textContent = IIC.friendlyError(error); return; }
    state.queries = state.queries.filter(q => q.id !== id); renderQueries();
  }

  /* ---------- tabs ---------- */
  function showTab(t) {
    document.querySelectorAll("nav button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
    ["dash", "reports", "summary", "queries", "depts", "emails"].forEach(k => $("tab-" + k).hidden = k !== t);
    if (t === "emails") loadMail();
  }
  document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

  /* ---------- submission link ---------- */
  const subUrl = location.origin + "/submit";
  $("subLink").textContent = subUrl;
  $("copyLink").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(subUrl); $("copyLink").textContent = "Copied"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("subLink")); getSelection().removeAllRanges(); getSelection().addRange(r); $("copyLink").textContent = "Press Ctrl+C"; }
    setTimeout(() => $("copyLink").textContent = "Copy link", 2000);
  });

  /* ---------- all reports ---------- */
  const lateInfo = r => IIC.lateInfo(r), lateCell = r => IIC.lateCell(r);
  function filteredReports() {
    const t = $("r_type").value, d = $("r_dept").value, q = $("r_q").value, v = $("r_ver").value, mo = $("r_m") ? $("r_m").value : "";
    const lf = $("r_late") ? $("r_late").value : "", rd = $("r_read") ? $("r_read").value : "";
    return state.reports.filter(r => (!t || r.type === t) && (!d || r.dept === d) && (!q || r.quarter === q) && (!mo || r.month === mo) && (!v || r.verification === v) && (!$("r_query").value || !!(r.query || "").trim())
        && (!lf || (lf === "late") === lateInfo(r).late) && (!rd || (rd === "unread") === isUnread(r)) && IICFramework.policyMatch(r, $("r_pol") ? $("r_pol").value : ""))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));   // newest submission first
  }
  // AI report check (Apps Script, Step 10): score, decision and what failed
  // number of beneficiaries, read from the report by the AI agent (Apps Script)
  const benOf = r => (r.ai_review && r.ai_review.beneficiaries) || null;
  function benCell(r) {
    const b = benOf(r);
    if (b && b.total != null) {
      const parts = [[b.students, "students"], [b.faculty, "faculty"], [b.external, "external"]].filter(x => x[0]).map(x => x[0] + " " + x[1]);
      return `<b class="ben-n" title="${esc(b.from ? "From the report: " + b.from : "Read from the report by the AI agent")}">${esc(String(b.total))}</b>${parts.length ? `<div class="hint">${esc(parts.join(" · "))}</div>` : ""}`;
    }
    if (r.ai_review && (r.ai_review.ben_tried || r.ai_checked_at)) return '<span class="hint">Not given in the report</span>';
    return r.drive_id && r.drive_id !== "missing" ? '<span class="hint">To be read by the AI agent</span>' : '<span class="hint">—</span>';
  }
  const benText = r => { const b = benOf(r); return b && b.total != null ? b.total : ""; };
  const benSplit = r => { const b = benOf(r); return b ? [[b.students, "students"], [b.faculty, "faculty"], [b.external, "external"]].filter(x => x[0]).map(x => x[0] + " " + x[1]).join(", ") : ""; };

  function aiCell(r) {
    if (!("ai_attempts" in r)) return "";
    const v = r.ai_review || {};
    if (!r.ai_checked_at) {
      if (v.error) {
        const e = String(v.error), why =
          /busy 429|RESOURCE_EXHAUSTED|quota/i.test(e) ? "Gemini's free limit was reached for now. It tries again automatically on the next run (every 5 minutes)." :
          /busy 5\d\d|overloaded|UNAVAILABLE|unreachable/i.test(e) ? "The AI service was busy. It tries again automatically on the next run (every 5 minutes)." :
          /AI service 40[13]|API key|PERMISSION_DENIED/i.test(e) ? "The AI key was not accepted. Check the Script property AI_API_KEY in Apps Script." :
          /AI service 404|not found for API|is not supported/i.test(e) ? "The AI model name is not available. Check AI_MODEL in Apps Script (e.g. gemini-3.8-flash)." :
          /AI service 400/i.test(e) ? "The AI service refused the request. Check AI_MODEL and AI_PROVIDER in Apps Script." :
          /not valid JSON|empty AI reply/i.test(e) ? "The AI's answer could not be read. Press Retry; if it repeats, try another AI_MODEL from Google AI Studio." :
          /readable Word|Invalid argument|unzip/i.test(e) ? "The file is not a readable Word (.docx) file. Ask the department to save it as .docx and upload again." :
          /getFileById|No item with the given ID|Drive/i.test(e) ? "The report file was not found in Google Drive." : "";
        return `<div class="ai-chip ai-err">AI check failed (${r.ai_attempts}/3) <button class="linkbtn" data-recheck="${esc(r.id)}">Retry</button>
          <div class="ai-why">${why ? esc(why) + "<br>" : ""}<span class="hint">${esc(e.slice(0, 160))}</span></div></div>`;
      }
      return r.verification === "Pending Verification" && r.drive_id && r.drive_id !== "missing" ? '<div class="ai-chip">AI check: waiting</div>' : "";
    }
    const fails = (v.checks || []).filter(c => !c.pass);
    const cls = r.ai_decision === "Verified" ? "ok" : "warn";
    return `<details class="ai-chip ai-${cls}"><summary>AI ${r.ai_score}/100 · ${esc(r.ai_decision === "Verified" ? "Verified" : "Returned")}${fails.length ? " · " + fails.length + " issue" + (fails.length > 1 ? "s" : "") : ""}</summary>
      ${v.summary ? `<p>${esc(v.summary)}</p>` : ""}
      ${v.relevance && v.relevance.score != null ? `<p><b>Relevance to the title${v.relevance.subject ? " (" + esc(v.relevance.subject) + ")" : ""}:</b> ${esc(String(v.relevance.score))}/100${(v.relevance.off_topic || []).length ? " · off-topic: " + v.relevance.off_topic.map(esc).join("; ") : ""}</p>` : ""}
      ${fails.length ? `<ul>${fails.map(c => `<li><b>${esc(c.id)}${c.critical ? " (critical)" : ""}</b> ${esc(c.note)}</li>`).join("")}</ul>` : "<p>All checks passed.</p>"}
      <p class="hint">${esc(String(v.words || "?"))} words · ${esc(String(v.images ?? "?"))} images · ${IIC.day(r.ai_checked_at)}</p>
      <button class="btn ghost small" data-recheck="${esc(r.id)}">Check again</button></details>`;
  }
  /* unread reports (like unread mail): bold until a coordinator opens the file, changes the status or remarks,
     or clicks the dot. Needs supabase-update-unread.sql (column seen_at); without it nothing is bold. */
  const isUnread = r => "seen_at" in r && !r.seen_at;
  function showRead(r) {
    const tr = document.querySelector(`#repTable tr[data-row="${CSS.escape(r.id)}"]`);
    if (tr) {
      tr.classList.toggle("unread", isUnread(r));
      const b = tr.querySelector("[data-seen]"); if (b) { const t = isUnread(r) ? "Mark as read" : "Mark as unread"; b.title = t; b.setAttribute("aria-label", t); }
    }
    unreadBadge();
  }
  function unreadBadge() {
    const n = state.reports.filter(isUnread).length, b = $("rBadge");
    if (b) { b.hidden = !n; b.textContent = n; }
  }
  async function setRead(id, read) {
    const r = state.reports.find(x => x.id === id); if (!r || !("seen_at" in r) || !isUnread(r) === read) return;
    const v = read ? new Date().toISOString() : null, old = r.seen_at;
    r.seen_at = v; showRead(r);
    const { error } = await sb.from("reports").update({ seen_at: v }).eq("id", id);
    if (error) { r.seen_at = old; showRead(r); $("repMsg").className = "msg err"; $("repMsg").textContent = IIC.friendlyError(error); }
  }

  function fileCell(r) {
    if (!r.file_path) return '<span class="hint">—</span>';
    // files are moved to the coordinator's Google Drive by the Apps Script (Step 9); until then they are in Supabase
    const fm = (r.formatted ? '<span class="pill p-ok fmt-pill" title="Formatted to the CII&amp;E report style by the AI formatting agent on upload">Formatted</span>' : "") +
      (r.resubmit_count ? `<span class="pill p-warn fmt-pill" title="Corrected file uploaded${r.resubmitted_at ? " on " + esc(IIC.day(r.resubmitted_at)) : ""}">Corrected${r.resubmit_count > 1 ? " ×" + r.resubmit_count : ""}</span>` : "") +
      (r.verification === "Returned for Correction" && r.edit_token ? `<div><button class="linkbtn" data-fixlink="${esc(r.id)}" title="The link in the department's email: opens this report to upload the corrected file">Copy correction link</button></div>` : "");
    if (r.drive_url) {
      // Drive's own preview and download links (not the Google Docs editor, which can't open some Word files and
      // says "Sorry, unable to open the file"); authuser picks the Google account that matches the coordinator signed in here
      const id = /^[\w-]{10,}$/.test(r.drive_id || "") ? r.drive_id : (/\/d\/([\w-]{10,})/.exec(r.drive_url) || [])[1];
      const au = encodeURIComponent(($("who") && $("who").textContent) || "");
      const view = id ? `https://drive.google.com/file/d/${id}/view?authuser=${au}` : r.drive_url;
      const down = id ? `https://drive.google.com/uc?export=download&id=${id}&authuser=${au}` : r.drive_url;
      return `<div class="filelink"><span title="${esc(r.file_name)}">${esc(r.file_name)}</span><a class="btn ghost small" href="${esc(view)}" target="_blank" rel="noopener" data-open="${esc(r.id)}">Open</a><a class="btn ghost small" href="${esc(down)}" target="_blank" rel="noopener" data-open="${esc(r.id)}" title="Download the Word file from Google Drive">Download</a></div>${fm}`;
    }
    if (r.drive_id === "missing") return `<div class="filelink"><span title="${esc(r.file_name)}">${esc(r.file_name)}</span><span class="hint">File not found</span></div>`;
    return `<div class="filelink"><span title="${esc(r.file_name)}">${esc(r.file_name)}</span><button class="btn ghost small" data-dl="${esc(r.id)}">Download</button></div>${fm}`;
  }
  function renderReports() {
    unreadBadge();
    const tbl = $("repTable");
    if (tbl.contains(document.activeElement) && document.activeElement.matches("textarea,select")) { repDeferred = true; return; }
    repDeferred = false;
    const cur = $("r_dept").value;
    const names = [...new Set(state.reports.filter(r => !$("r_type").value || r.type === $("r_type").value).map(r => r.dept))].sort(byName);
    $("r_dept").innerHTML = '<option value="">All departments</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    if (names.includes(cur)) $("r_dept").value = cur;
    // month filter: the months that have reports (newest first), limited to the chosen quarter
    const curM = $("r_m").value;
    const months = [...new Set(state.reports.filter(r => r.month && (!$("r_q").value || r.quarter === $("r_q").value)).map(r => r.month))].sort().reverse();
    $("r_m").innerHTML = '<option value="">All months</option>' + months.map(m => `<option value="${esc(m)}">${esc(IIC.monthLabel(m))}</option>`).join("");
    if (months.includes(curM)) $("r_m").value = curM;
    const list = filteredReports();
    if (!state.reports.length) { tbl.innerHTML = '<div class="empty">No reports yet. They appear here as departments submit them from the submission page.</div>'; return; }
    if (!list.length) { tbl.innerHTML = '<div class="empty">No reports match these filters.</div>'; return; }
    tbl.innerHTML = `<p class="hint" style="margin-bottom:8px">${list.length} report${list.length > 1 ? "s" : ""}</p><table class="rep"><thead><tr><th>Submitted on</th><th>Type</th><th>Department</th><th>Faculty</th><th>Mobile</th><th>Quarter</th><th>Month</th><th>Report title</th><th>Beneficiaries</th><th>NIRF / NISP</th><th>Report file</th><th>Late submission</th><th>Query from department</th><th>Submission</th><th>Verification</th><th>Remarks</th><th></th></tr></thead><tbody>` +
      list.map(r => {
        const opts = VERS.map(v => `<option${v === r.verification ? " selected" : ""}>${esc(v)}</option>`).join("");
        return `<tr class="${isUnread(r) ? "unread" : ""}" data-row="${esc(r.id)}"><td style="white-space:nowrap">${"seen_at" in r ? `<button class="read-dot" data-seen="${esc(r.id)}" title="${isUnread(r) ? "Mark as read" : "Mark as unread"}" aria-label="${isUnread(r) ? "Mark as read" : "Mark as unread"}"></button>` : ""}<b>${IIC.day(r.created_at)}</b><div class="hint">${r.created_at ? esc(new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })) : ""}</div></td><td><span class="tag">${esc(r.type)}</span></td><td>${esc(r.dept)}</td><td>${esc(r.faculty)}${r.email ? `<div class="hint" style="overflow-wrap:anywhere">${esc(r.email)}</div>` : ""}</td><td style="font-variant-numeric:tabular-nums">${esc(r.mobile)}</td>
          <td style="white-space:nowrap">${esc(IIC.qShort(r.quarter))}</td><td style="white-space:nowrap">${esc(IIC.monthLabel(r.month) || "—")}</td><td style="min-width:220px">${esc(r.title)}<div><select class="actsel" data-act="${esc(r.id)}" aria-label="IIC activity for ${esc(r.title)}">${IICFramework.allOptions(r.iic_activity || "")}</select></div></td><td style="min-width:120px">${benCell(r)}</td><td style="min-width:170px">${IICFramework.policyCell(r)}</td><td>${fileCell(r)}</td>
          <td style="white-space:nowrap">${lateCell(r)}</td><td style="min-width:160px">${r.query ? `<div class="query">${esc(r.query)}</div>` : '<span class="hint">—</span>'}</td><td>${IIC.subPill(r.submission)}</td>
          <td><select class="vsel v-${IIC.verClass(r.verification)}" data-ver="${esc(r.id)}" aria-label="Verification status for ${esc(r.title)}">${opts}</select>${aiCell(r)}</td>
          <td><textarea class="rem" rows="2" maxlength="1000" data-rem="${esc(r.id)}" aria-label="Remarks for ${esc(r.title)}" placeholder="Add remarks">${esc(r.remarks)}</textarea></td>
          <td><button class="btn danger small" data-del-report="${esc(r.id)}">Delete</button></td></tr>`;
      }).join("") + "</tbody></table>";
  }
  if ($("r_pol")) $("r_pol").innerHTML = IICFramework.policyFilterOptions();
  ["r_type", "r_dept", "r_q", "r_m", "r_ver", "r_query", "r_late", "r_pol", "r_read"].forEach(id => $(id).addEventListener("change", renderReports));

  async function patchReport(id, fields, el) {
    const m = $("repMsg"), r = state.reports.find(x => x.id === id); if (!r) return;
    m.className = "msg"; m.textContent = "Saving…";
    if (isUnread(r) && (fields.verification !== undefined || fields.remarks !== undefined)) fields = { ...fields, seen_at: new Date().toISOString() };
    const { error } = await sb.from("reports").update(fields).eq("id", id);
    if (error) {
      m.className = "msg err"; m.textContent = IIC.friendlyError(error);
      if (fields.remarks !== undefined && fields.verification !== undefined) { const ta = document.querySelector(`[data-rem="${CSS.escape(id)}"]`); if (ta) ta.value = r.remarks || ""; }
      if (el) { el.value = fields.verification !== undefined ? r.verification : fields.iic_activity !== undefined ? (r.iic_activity || "") : (r.remarks || ""); if (el.dataset.ver) el.className = "vsel v-" + IIC.verClass(el.value); }
      return;
    }
    Object.assign(r, fields);
    if ("seen_at" in fields) showRead(r);
    m.className = "msg ok"; m.textContent = "Saved: " + r.dept + " · " + IIC.qShort(r.quarter) + " · " + r.title;
    renderSummary();
  }
  $("repTable").addEventListener("change", e => {
    const ac = e.target.closest("[data-act]");
    if (ac) { patchReport(ac.dataset.act, { iic_activity: ac.value || null }, ac); return; }
    const v = e.target.closest("[data-ver]");
    if (v) {
      v.className = "vsel v-" + IIC.verClass(v.value);
      const f = { verification: v.value };
      // Verified: "Thanks for Submission" goes in Remarks unless the coordinator has written something of their own
      const ta = document.querySelector(`[data-rem="${CSS.escape(v.dataset.ver)}"]`);
      if (v.value === "Verified" && ta && (!ta.value.trim() || /^(Late entry added by|AI check )/.test(ta.value.trim()))) { f.remarks = THANKS; ta.value = THANKS; }
      patchReport(v.dataset.ver, f, v); return;
    }
    const t = e.target.closest("[data-rem]");
    if (t) { const val = t.value.trim(), r = state.reports.find(x => x.id === t.dataset.rem); if (r && val !== (r.remarks || "")) patchReport(t.dataset.rem, { remarks: val }, t); }
  });
  $("repTable").addEventListener("focusout", () => {
    setTimeout(() => { if (repDeferred && !$("repTable").contains(document.activeElement)) renderReports(); }, 0);
  });

  async function downloadReport(id, btn) {
    const r = state.reports.find(x => x.id === id); if (!r) return;
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Preparing…";
    const { data, error } = await sb.storage.from(IIC.BUCKET).download(r.file_path);
    btn.disabled = false;
    if (error) { btn.textContent = "Download failed"; return; }
    btn.textContent = label;
    IIC.saveBlob(data, r.file_name || "report.docx");
  }
  async function deleteReport(id) {
    const r = state.reports.find(x => x.id === id); if (!r) return;
    const { error } = await sb.from("reports").delete().eq("id", id);
    if (error) { const m = $("repMsg"); m.className = "msg err"; m.textContent = IIC.friendlyError(error); return; }
    if (r.file_path && !r.drive_id) await sb.storage.from(IIC.BUCKET).remove([r.file_path]);
    if (r.drive_url) { const m = $("repMsg"); m.className = "msg"; m.innerHTML = `Report deleted. Its Word file is still in Google Drive; <a href="${esc(r.drive_url)}" target="_blank" rel="noopener">open it</a> to delete it there too.`; }
    state.reports = state.reports.filter(x => x.id !== id);
    renderReports(); renderSummary(); renderDepts();
  }

  /* ---------- departments ---------- */
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function validDept(type, name, fac, mob, email) {
    if (!["Aided", "SF"].includes(type)) return "Choose Aided or SF.";
    if (!name) return "Enter the department name.";
    if (!fac) return "Enter the faculty name.";
    if (!/^[6-9]\d{9}$/.test(mob)) return "Enter a valid 10-digit mobile number.";
    if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
    if (state.depts.some(d => d.type === type && d.name.toLowerCase() === name.toLowerCase() && d.faculty.toLowerCase() === fac.toLowerCase())) return fac + " is already listed under " + name + ".";
    return "";
  }
  $("deptForm").addEventListener("submit", async e => {
    e.preventDefault();
    const m = $("deptMsg"), t = $("d_type").value, n = $("d_name").value.replace(/\s+/g, " ").trim(), f = $("d_fac").value.replace(/\s+/g, " ").trim(), mob = $("d_mob").value.replace(/\D/g, ""), em = $("d_email").value.trim().toLowerCase();
    const err = validDept(t, n, f, mob, em); if (err) { m.className = "msg err"; m.textContent = err; return; }
    const { error } = await sb.from("departments").insert({ type: t, name: n, faculty: f, mobile: mob, email: em });
    if (error) { m.className = "msg err"; m.textContent = IIC.friendlyError(error); return; }
    $("d_name").value = ""; $("d_fac").value = ""; $("d_mob").value = ""; $("d_email").value = "";
    m.className = "msg ok"; m.textContent = "Added " + f + " (" + n + ")."; $("d_name").focus();
    loadDepts();
  });
  $("bulkBtn").addEventListener("click", async () => {
    const m = $("bulkMsg"), lines = $("bulk").value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [], bad = [];
    lines.forEach((l, i) => {
      const p = l.split(/\t|,/).map(s => s.replace(/\s+/g, " ").trim());
      let t = p[0] || ""; t = /^aided$/i.test(t) ? "Aided" : /^sf$/i.test(t) ? "SF" : t;
      const mob = (p[3] || "").replace(/\D/g, ""), em = (p[4] || "").toLowerCase();
      let err = validDept(t, p[1] || "", p[2] || "", mob, em);
      if (!err && rows.some(r => r.type === t && r.name.toLowerCase() === p[1].toLowerCase() && r.faculty.toLowerCase() === p[2].toLowerCase())) err = "repeated in the list";
      if (err) bad.push("line " + (i + 1) + ": " + err); else rows.push({ type: t, name: p[1], faculty: p[2], mobile: mob, email: em });
    });
    let ok = 0;
    if (rows.length) {
      const { error } = await sb.from("departments").insert(rows);
      if (error) bad.push(IIC.friendlyError(error)); else ok = rows.length;
    }
    m.className = bad.length ? "msg err" : "msg ok";
    m.textContent = `Added ${ok}.` + (bad.length ? " Skipped " + bad.length + " — " + bad.slice(0, 3).join("; ") + (bad.length > 3 ? "…" : "") : "");
    if (!bad.length) $("bulk").value = "";
    loadDepts();
  });
  async function deleteDept(id) {
    const { error } = await sb.from("departments").delete().eq("id", id);
    if (error) { const m = $("deptMsg"); m.className = "msg err"; m.textContent = IIC.friendlyError(error); return; }
    loadDepts();
  }
  let editingDept = null;
  function renderDepts() {
    $("deptNames").innerHTML = [...new Set(state.depts.map(d => d.name))].sort(byName).map(n => `<option value="${esc(n)}">`).join("");
    if (!state.depts.length) { $("deptTable").innerHTML = '<div class="empty">No departments yet. Add the first one above, or paste a list from Excel.</div>'; return; }
    if (editingDept && $("deptTable").contains(document.activeElement) && document.activeElement.matches("input,select")) return;
    const rows = [...state.depts].sort((a, b) => byName(a.type, b.type) || byName(a.name, b.name) || byName(a.faculty, b.faculty));
    $("deptTable").innerHTML = `<table class="depttbl"><thead><tr><th>Type</th><th>Department</th><th>Faculty</th><th>Mobile</th><th>Email</th><th class="n">Reports</th><th></th></tr></thead><tbody>` +
      rows.map(d => {
        const c = state.reports.filter(r => r.type === d.type && r.dept === d.name && r.faculty === d.faculty).length;
        if (d.id === editingDept) return `<tr class="editing">
          <td><select id="e_type" aria-label="Aided or SF"><option${d.type === "Aided" ? " selected" : ""}>Aided</option><option${d.type === "SF" ? " selected" : ""}>SF</option></select></td>
          <td><input id="e_name" maxlength="150" list="deptNames" value="${esc(d.name)}" aria-label="Department name"></td>
          <td><input id="e_fac" maxlength="120" value="${esc(d.faculty)}" aria-label="Faculty name"></td>
          <td><input id="e_mob" inputmode="numeric" maxlength="10" value="${esc(d.mobile)}" aria-label="Mobile number" style="min-width:120px"></td>
          <td><input id="e_email" type="email" maxlength="150" value="${esc(d.email || "")}" placeholder="Email" aria-label="Email" style="min-width:200px"></td>
          <td class="n">${c}</td>
          <td style="white-space:nowrap"><button class="btn small" data-save-dept="${esc(d.id)}">Save</button> <button class="btn ghost small" data-cancel-dept>Cancel</button></td></tr>`;
        return `<tr><td><span class="tag">${esc(d.type)}</span></td><td>${esc(d.name)}</td><td>${esc(d.faculty)}</td><td style="font-variant-numeric:tabular-nums">${esc(d.mobile)}</td>
          <td style="overflow-wrap:anywhere">${d.email ? esc(d.email) : '<span class="hint">No email</span>'}</td>
          <td class="n">${c}</td>
          <td style="white-space:nowrap"><button class="btn ghost small" data-edit-dept="${esc(d.id)}">Edit</button> <button class="btn danger small" data-del-dept="${esc(d.id)}">Delete</button></td></tr>`;
      }).join("") + "</tbody></table>";
  }
  function deptMsg(kind, text) { const m = $("deptTblMsg"); m.className = "msg" + (kind ? " " + kind : ""); m.textContent = text; }
  // Save an edited row. Renaming also updates that faculty's earlier reports and queries, and a new
  // department name is applied to every faculty row of that department, so nothing is split or lost.
  async function saveDept(id, btn) {
    const d = state.depts.find(x => x.id === id); if (!d) return;
    const t = $("e_type").value, n = $("e_name").value.replace(/\s+/g, " ").trim(), f = $("e_fac").value.replace(/\s+/g, " ").trim(),
      mob = $("e_mob").value.replace(/\D/g, ""), em = $("e_email").value.trim().toLowerCase();
    let err = !["Aided", "SF"].includes(t) ? "Choose Aided or SF." : !n ? "Enter the department name." : !f ? "Enter the faculty name."
      : !/^[6-9]\d{9}$/.test(mob) ? "Enter a valid 10-digit mobile number." : !EMAIL_RE.test(em) ? "Enter a valid email address." : "";
    if (!err && state.depts.some(x => x.id !== id && x.type === t && x.name.toLowerCase() === n.toLowerCase() && x.faculty.toLowerCase() === f.toLowerCase()))
      err = f + " is already listed under " + n + " (" + t + ").";
    if (err) { deptMsg("err", err); return; }
    const deptChanged = t !== d.type || n !== d.name, facChanged = f !== d.faculty;
    if (!deptChanged && !facChanged && mob === d.mobile && em === (d.email || "")) { editingDept = null; renderDepts(); deptMsg("", ""); return; }
    btn.disabled = true; deptMsg("", "Saving…");
    try {
      const ck = r => { if (r.error) throw r.error; };
      ck(await sb.from("departments").update({ type: t, name: n, faculty: f, mobile: mob, email: em }).eq("id", id));
      // this faculty member's earlier reports and queries follow the new details
      for (const table of ["reports", "queries"]) {
        const r = await sb.from(table).update({ type: t, dept: n, faculty: f, mobile: mob, email: em }).eq("type", d.type).eq("dept", d.name).eq("faculty", d.faculty);
        if (r.error && !(table === "queries" && /queries/.test(r.error.message || ""))) throw r.error;
      }
      let others = 0;
      if (deptChanged) {
        // the rest of the department moves with it
        const rest = state.depts.filter(x => x.id !== id && x.type === d.type && x.name === d.name);
        for (const x of rest) {
          ck(await sb.from("departments").update({ type: t, name: n }).eq("id", x.id));
          for (const table of ["reports", "queries"]) {
            const r = await sb.from(table).update({ type: t, dept: n }).eq("type", d.type).eq("dept", d.name).eq("faculty", x.faculty);
            if (r.error && !(table === "queries" && /queries/.test(r.error.message || ""))) throw r.error;
          }
        }
        others = rest.length;
      }
      editingDept = null;
      deptMsg("ok", "Saved " + f + " (" + n + ")." + (others ? " The department name was also updated for " + others + " other faculty member" + (others > 1 ? "s" : "") + "." : "") +
        (deptChanged || facChanged ? " Earlier reports were updated to match." : ""));
      await Promise.all([loadDepts(), loadReports(), loadQueries()]);
    } catch (e) {
      deptMsg("err", IIC.friendlyError(e)); btn.disabled = false;
    }
  }
  $("deptTable").addEventListener("click", e => {
    const ed = e.target.closest("[data-edit-dept]");
    if (ed) { editingDept = ed.dataset.editDept; deptMsg("", ""); renderDepts(); $("e_fac").focus(); return; }
    if (e.target.closest("[data-cancel-dept]")) { editingDept = null; deptMsg("", ""); renderDepts(); return; }
    const sv = e.target.closest("[data-save-dept]");
    if (sv) saveDept(sv.dataset.saveDept, sv);
  });
  $("deptTable").addEventListener("keydown", e => {
    if (!editingDept) return;
    if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); const b = $("deptTable").querySelector("[data-save-dept]"); if (b) saveDept(editingDept, b); }
    if (e.key === "Escape") { editingDept = null; deptMsg("", ""); renderDepts(); }
  });

  /* ---------- two-click delete + downloads ---------- */
  document.addEventListener("click", e => {
    const fl = e.target.closest("[data-fixlink]");
    if (fl) {
      const r = state.reports.find(x => x.id === fl.dataset.fixlink); if (!r) return;
      const url = location.origin + "/submit?fix=" + r.id + "&t=" + r.edit_token;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { fl.textContent = "Link copied"; },
        () => { window.prompt("Correction link for " + r.dept + ":", url); }).finally(() => setTimeout(() => { if (fl.isConnected) fl.textContent = "Copy correction link"; }, 2500));
      return;
    }
    const rc = e.target.closest("[data-recheck]");
    if (rc) { e.preventDefault(); patchReport(rc.dataset.recheck, { verification: "Pending Verification", ai_checked_at: null, ai_attempts: 0, ai_review: null, ai_score: null, ai_decision: null }, rc).then(renderReports); return; }
    const b = e.target.closest("[data-del-report],[data-del-dept],[data-del-query]");
    if (b) {
      if (!b.classList.contains("armed")) {
        b.classList.add("armed"); b.textContent = "Confirm";
        setTimeout(() => { if (b.isConnected) { b.classList.remove("armed"); b.textContent = "Delete"; } }, 4000);
        return;
      }
      b.disabled = true;
      if (b.dataset.delReport) deleteReport(b.dataset.delReport); else if (b.dataset.delQuery) deleteQuery(b.dataset.delQuery); else deleteDept(b.dataset.delDept);
      return;
    }
    const sd = e.target.closest("[data-seen]");
    if (sd) { const r = state.reports.find(x => x.id === sd.dataset.seen); if (r) setRead(r.id, isUnread(r)); return; }
    const op = e.target.closest("[data-open]");
    if (op) setRead(op.dataset.open, true);
    const dl = e.target.closest("[data-dl]");
    if (dl && !dl.disabled) { setRead(dl.dataset.dl, true); downloadReport(dl.dataset.dl, dl); }
  });

  /* ---------- summary ---------- */
  function summaryRows() {
    const out = [];
    for (const type of ["Aided", "SF"]) {
      const names = [...new Set([...state.depts.filter(d => d.type === type).map(d => d.name), ...state.reports.filter(r => r.type === type).map(r => r.dept)])].sort(byName);
      if (!names.length) continue;
      const rows = names.map(n => {
        const sub = state.reports.filter(r => r.type === type && r.dept === n && r.submission === "Submitted");
        return { type, name: n, q: QS.map(q => sub.filter(r => r.quarter === q).length), total: sub.length, verified: sub.filter(r => r.verification === "Verified").length };
      });
      const tot = { type, name: type + " total", q: QS.map((_, i) => rows.reduce((s, r) => s + r.q[i], 0)), total: rows.reduce((s, r) => s + r.total, 0), verified: rows.reduce((s, r) => s + r.verified, 0) };
      out.push({ type, rows, tot });
    }
    return out;
  }
  function renderSummary() {
    if (window.IICDash) IICDash.render(state);
    if (window.IICCat) IICCat.render(state);
    const all = state.reports, sub = all.filter(r => r.submission === "Submitted");
    const tiles = [["Reports received", all.length], ["Verified", sub.filter(r => r.verification === "Verified").length],
      ["Awaiting verification", sub.filter(r => r.verification === "Pending Verification").length],
      ["Returned or rejected", sub.filter(r => ["Returned for Correction", "Rejected"].includes(r.verification)).length]];
    $("tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("");
    const groups = summaryRows();
    if (!groups.length) { $("sumTable").innerHTML = '<div class="empty">Counts appear here once departments or reports are added.</div>'; return; }
    const tr = (r, cls = "") => `<tr class="${cls}"><td>${cls ? "" : `<span class="tag">${esc(r.type)}</span> `}${esc(r.name)}</td>${r.q.map(v => `<td class="n">${v}</td>`).join("")}<td class="n"><b>${r.total}</b></td><td class="n">${r.verified}</td><td class="n">${r.total - r.verified}</td></tr>`;
    const grand = { name: "Consolidated total (Aided + SF)", q: QS.map((_, i) => groups.reduce((s, g) => s + g.tot.q[i], 0)), total: groups.reduce((s, g) => s + g.tot.total, 0), verified: groups.reduce((s, g) => s + g.tot.verified, 0) };
    $("sumTable").innerHTML = `<table><thead><tr><th>Department</th><th class="n">Q1</th><th class="n">Q2</th><th class="n">Q3</th><th class="n">Q4</th><th class="n">Total submitted</th><th class="n">Verified</th><th class="n">Not verified</th></tr></thead><tbody>` +
      groups.map(g => g.rows.map(r => tr(r)).join("") + tr(g.tot, "sub")).join("") + tr(grand, "grand") + "</tbody></table>";

  }

  /* ---------- Excel + PDF downloads ---------- */
  const REP_HEAD = ["S.No", "Aided/SF", "Department", "Faculty", "Mobile", "Email", "Quarter", "Month", "Activity type", "NIRF / NISP classification", "Report title", "Beneficiaries", "Beneficiaries (break-up)", "Report file", "Submitted on", "Late submission", "Submission", "Verification", "Remarks", "Queries / Difficulties", "Drive link", "AI check"];
  function reportRows() {
    return filteredReports().map((r, i) => [i + 1, r.type, r.dept, r.faculty, r.mobile, r.email || "", r.quarter, IIC.monthLabel(r.month), IICFramework.labelOf(r.iic_activity), IICFramework.policyText(r), r.title, benText(r), benSplit(r), r.file_name || "", IIC.day(r.created_at), lateInfo(r).late ? "Late (" + lateInfo(r).days + " days; due " + lateInfo(r).deadline + ")" : "On time", r.submission, r.verification, r.remarks || "", r.query || "", r.drive_url || "", r.ai_checked_at ? r.ai_score + "/100 " + (r.ai_decision || "") : ""]);
  }
  function filterLabel() {
    const parts = [["r_type", "Aided & SF"], ["r_dept", "All departments"], ["r_q", "All quarters"], ["r_m", "All months"], ["r_ver", "Any verification status"]]
      .map(([id, all]) => id === "r_m" ? ($(id).value ? IIC.monthLabel($(id).value) : all) : ($(id).value || all));
    return parts.join(" · ");
  }
  const SUM_HEAD = ["Aided/SF", "Department", "Q1", "Q2", "Q3", "Q4", "Total submitted", "Verified", "Not verified"];
  function summaryData() {
    const rows = [], kinds = [];
    let G = [0, 0, 0, 0, 0, 0];
    summaryRows().forEach(x => {
      x.rows.forEach(r => { rows.push([x.type, r.name, ...r.q, r.total, r.verified, r.total - r.verified]); kinds.push(""); });
      const t = x.tot;
      rows.push([x.type, t.name, ...t.q, t.total, t.verified, t.total - t.verified]); kinds.push("sub");
      G = G.map((v, i) => v + [...t.q, t.total, t.verified][i]);
    });
    if (rows.length) { rows.push(["", "Consolidated total (Aided + SF)", ...G.slice(0, 5), G[5], G[4] - G[5]]); kinds.push("grand"); }
    return { rows, kinds };
  }
  function summaryIntro() {
    const all = state.reports, sub = all.filter(r => r.submission === "Submitted");
    return "Reports received: " + all.length + "   Verified: " + sub.filter(r => r.verification === "Verified").length +
      "   Awaiting verification: " + sub.filter(r => r.verification === "Pending Verification").length +
      "   Returned or rejected: " + sub.filter(r => ["Returned for Correction", "Rejected"].includes(r.verification)).length;
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  async function runExport(btn, fn, msgId = "repMsg") {
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Preparing…";
    try { await fn(); btn.textContent = label; }
    catch (e) { btn.textContent = "Failed – try again"; setTimeout(() => btn.textContent = label, 3000); const m = $(msgId); m.className = "msg err"; m.textContent = IIC.friendlyError(e); }
    finally { btn.disabled = false; }
  }
  async function excelWorkbook() {
    const s = summaryData();
    return IICExport.toExcel([
      { name: "All reports", title: "IIC Quarterly Reports", subtitle: filterLabel(), head: REP_HEAD, rows: reportRows(),
        widths: [6, 9, 28, 22, 12, 28, 11, 15, 40, 40, 45, 13, 30, 28, 13, 26, 13, 22, 40, 40, 50, 22] },
      { name: "Department summary", title: "Department-wise Submitted Reports", subtitle: summaryIntro(), head: SUM_HEAD, rows: s.rows,
        widths: [9, 36, 6, 6, 6, 6, 15, 10, 13] },
      ...catSheets()
    ]);
  }
  $("xlsxReports").addEventListener("click", e => runExport(e.currentTarget, async () => {
    if (!filteredReports().length) throw new Error("There are no reports to download for these filters.");
    IIC.saveBlob(await excelWorkbook(), "IIC_Reports_" + stamp() + ".xlsx");
  }));
  $("xlsxSummary").addEventListener("click", e => runExport(e.currentTarget, async () => {
    IIC.saveBlob(await excelWorkbook(), "IIC_Reports_" + stamp() + ".xlsx");
  }));
  $("pdfReports").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const rows = reportRows();
    if (!rows.length) throw new Error("There are no reports to download for these filters.");
    const blob = await IICExport.toPdf({
      title: "IIC Quarterly Reports", subtitle: filterLabel() + "  ·  " + rows.length + " report(s)", orientation: "landscape",
      // row fields (see REP_HEAD): 0 S.No, 1 type, 2 dept, 3 faculty, 4 mobile, 5 email, 6 quarter, 7 month, 8 activity, 9 NIRF/NISP,
      // 10 title, 11 beneficiaries, 12 break-up, 13 file, 14 submitted on, 15 late, 16 submission, 17 verification, 18 remarks, 19 query
      head: ["S.No", "Aided/SF", "Department", "Faculty", "Mobile", "Quarter", "Month", "Report title", "Beneficiaries", "Report file", "Submitted on", "Verification", "Remarks"],
      rows: rows.map(r => [r[0], r[1], r[2], r[3] + (r[5] ? "\n" + r[5] : ""), r[4], IIC.qShort(r[6]), r[7], r[10] + (r[8] ? "\n" + r[8] : "") + (r[19] ? "\nQuery: " + r[19] : ""),
        r[11] === "" ? "" : r[11] + (r[12] ? "\n" + r[12] : ""), r[13], r[14], r[17], r[18]]),
      columnStyles: { 0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 36 }, 2: { cellWidth: 70 }, 3: { cellWidth: 90 }, 4: { cellWidth: 52 }, 5: { cellWidth: 28, halign: "center" }, 6: { cellWidth: 48 },
        7: { cellWidth: 100 }, 8: { cellWidth: 52, halign: "center" }, 9: { cellWidth: 70 }, 10: { cellWidth: 48 }, 11: { cellWidth: 56 }, 12: { cellWidth: "auto" } },
      fontSize: 7.5
    });
    IIC.saveBlob(blob, "IIC_Reports_" + stamp() + ".pdf");
  }));
  $("pdfSummary").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const s = summaryData();
    if (!s.rows.length) throw new Error("Nothing to download yet. Add departments or wait for reports.");
    const num = { halign: "center" };
    const blob = await IICExport.toPdf({
      title: "Department-wise Submitted Reports", subtitle: "Counts reports marked Submitted, by quarter", orientation: "portrait",
      intro: summaryIntro(), head: SUM_HEAD, rows: s.rows, rowKinds: s.kinds,
      columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: "auto" }, 2: num, 3: num, 4: num, 5: num, 6: num, 7: num, 8: num },
      fontSize: 9
    });
    IIC.saveBlob(blob, "IIC_Department_Summary_" + stamp() + ".pdf");
  }));

  // Reports by activity type
  function catSheets() {
    return [
      { name: "Activity types", title: "Reports by Activity Type", subtitle: "Each report counted under one type, from its title",
        head: IICCat.HEAD, rows: IICCat.exportRows(state), widths: [5, 62, 6, 6, 6, 6, 9, 12] },
      { name: "Activity type reports", title: "Reports under each Activity Type", subtitle: "",
        head: ["Activity type", "Aided/SF", "Department", "Quarter", "Month", "Report title", "Verification"],
        rows: IICCat.exportDetail(state), widths: [26, 9, 30, 8, 10, 50, 20] }
    ];
  }
  $("xlsxCats").addEventListener("click", e => runExport(e.currentTarget, async () => {
    if (!state.reports.length) throw new Error("No reports to download yet.");
    IIC.saveBlob(await IICExport.toExcel(catSheets()), "IIC_Activity_Types_" + stamp() + ".xlsx");
  }, "catMsg"));
  $("pdfCats").addEventListener("click", e => runExport(e.currentTarget, async () => {
    if (!state.reports.length) throw new Error("No reports to download yet.");
    const num = { halign: "center" };
    const rows = IICCat.exportRows(state);
    const blob = await IICExport.toPdf({ title: "Reports by IIC Activity Type", subtitle: "Each report counted under one type, from its title",
      orientation: "portrait", head: IICCat.HEAD, rows, rowKinds: rows.map((_, i) => i === rows.length - 1 ? "grand" : ""),
      columnStyles: { 0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: "auto" }, 2: num, 3: num, 4: num, 5: num, 6: num, 7: num }, fontSize: 9 });
    IIC.saveBlob(blob, "IIC_Activity_Types_" + stamp() + ".pdf");
  }, "catMsg"));

  // Queries list
  const Q_HEAD = ["S.No", "Received", "Aided/SF", "Department", "Faculty", "Mobile", "Email", "Quarter", "Month", "Report", "Query", "Status", "Reply"];
  const queryRows = () => filteredQueries().map((q, i) => [i + 1, IIC.day(q.created_at), q.type, q.dept, q.faculty, q.mobile || "", q.email || "",
    q.quarter || "", IIC.monthLabel(q.month), (q.report_id ? "Submitted" : "Not submitted") + (q.title ? ": " + q.title : ""), q.query, q.status, q.reply || ""]);
  $("xlsxQueries").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const rows = queryRows(); if (!rows.length) throw new Error("No queries to download for these filters.");
    IIC.saveBlob(await IICExport.toExcel([{ name: "Queries", title: "Queries from Departments", subtitle: rows.length + " quer" + (rows.length > 1 ? "ies" : "y"),
      head: Q_HEAD, rows, widths: [6, 13, 9, 28, 22, 12, 28, 11, 15, 30, 50, 12, 50] }]), "IIC_Queries_" + stamp() + ".xlsx");
  }, "qMsg"));
  $("pdfQueries").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const rows = queryRows(); if (!rows.length) throw new Error("No queries to download for these filters.");
    const blob = await IICExport.toPdf({ title: "Queries from Departments", subtitle: rows.length + " quer" + (rows.length > 1 ? "ies" : "y"), orientation: "landscape",
      head: ["S.No", "Received", "Aided/SF", "Department", "Faculty", "Quarter / Month", "Report", "Query", "Status", "Reply"],
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4] + (r[5] ? "\n" + r[5] : ""), IIC.qShort(r[7]) + (r[8] ? "\n" + r[8] : ""), r[9], r[10], r[11], r[12]]),
      columnStyles: { 0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 50 }, 2: { cellWidth: 36 }, 3: { cellWidth: 74 }, 4: { cellWidth: 80 }, 5: { cellWidth: 56 },
        6: { cellWidth: 76 }, 7: { cellWidth: 150 }, 8: { cellWidth: 52 }, 9: { cellWidth: "auto" } }, fontSize: 7.5 });
    IIC.saveBlob(blob, "IIC_Queries_" + stamp() + ".pdf");
  }, "qMsg"));

  // Departments & faculty list
  const DEPT_HEAD = ["S.No", "Aided/SF", "Department", "Faculty", "Mobile", "Email", "Reports submitted"];
  function deptRows() {
    return [...state.depts].sort((a, b) => byName(a.type, b.type) || byName(a.name, b.name) || byName(a.faculty, b.faculty))
      .map((d, i) => [i + 1, d.type, d.name, d.faculty, d.mobile, d.email || "",
        state.reports.filter(r => r.type === d.type && r.dept === d.name && r.faculty === d.faculty).length]);
  }
  function deptSubtitle(rows) {
    const aided = rows.filter(r => r[1] === "Aided").length, sf = rows.length - aided;
    const nDepts = new Set(rows.map(r => r[1] + "|" + r[2])).size;
    return nDepts + " departments · " + rows.length + " faculty (Aided " + aided + ", SF " + sf + ")";
  }
  $("xlsxDepts").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const rows = deptRows();
    if (!rows.length) throw new Error("No departments to download yet.");
    const blob = await IICExport.toExcel([{ name: "Departments & faculty", title: "Departments & Faculty Coordinators", subtitle: deptSubtitle(rows),
      head: DEPT_HEAD, rows, widths: [6, 9, 34, 26, 13, 32, 10] }]);
    IIC.saveBlob(blob, "IIC_Departments_Faculty_" + stamp() + ".xlsx");
  }, "deptTblMsg"));
  $("pdfDepts").addEventListener("click", e => runExport(e.currentTarget, async () => {
    const rows = deptRows();
    if (!rows.length) throw new Error("No departments to download yet.");
    const blob = await IICExport.toPdf({ title: "Departments & Faculty Coordinators", subtitle: deptSubtitle(rows), orientation: "portrait",
      head: ["S.No", "Aided/SF", "Department", "Faculty", "Mobile", "Email", "Reports"], rows,
      columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 42 }, 2: { cellWidth: 110 }, 3: { cellWidth: 100 }, 4: { cellWidth: 62 },
        5: { cellWidth: "auto" }, 6: { cellWidth: 40, halign: "center" } }, fontSize: 8 });
    IIC.saveBlob(blob, "IIC_Departments_Faculty_" + stamp() + ".pdf");
  }, "deptTblMsg"));

  /* ---------- emails ---------- */
  const KIND = { submitted: "Acknowledgement", status: "Verification result", reminder: "Monthly reminder", reminder_summary: "Reminder summary", test: "Test" };
  let mailLoaded = false;
  async function loadMail() {
    if (!mailLoaded) {
      const { data, error } = await sb.rpc("admin_mail_settings");
      if (error) { $("mailNotReady").hidden = false; $("mailReady").hidden = true; return; }
      mailLoaded = true;
      $("mailNotReady").hidden = true; $("mailReady").hidden = false;
      $("m_secret").textContent = data.secret || "";
      $("m_url").value = data.webhook_url || "";
      $("m_admin").value = data.admin_email || "";
      $("m_site").value = data.site_url || location.origin;
      $("m_rem").checked = !!data.reminders_enabled;
    }
    loadLog();
  }
  function mailMsg(id, kind, text) { const m = $(id); m.className = "msg" + (kind ? " " + kind : ""); m.textContent = text; }
  $("copySecret").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("m_secret").textContent); $("copySecret").textContent = "Copied"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("m_secret")); getSelection().removeAllRanges(); getSelection().addRange(r); $("copySecret").textContent = "Press Ctrl+C"; }
    setTimeout(() => $("copySecret").textContent = "Copy", 2000);
  });
  $("mailForm").addEventListener("submit", async e => {
    e.preventDefault();
    const url = $("m_url").value.trim();
    if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) { mailMsg("m_msg", "err", "The Apps Script link should look like https://script.google.com/macros/s/…/exec"); return; }
    $("m_save").disabled = true; mailMsg("m_msg", "", "Saving…");
    const { error } = await sb.rpc("admin_save_mail_settings", { p_url: url, p_admin_email: $("m_admin").value.trim(), p_site_url: $("m_site").value.trim().replace(/\/+$/, ""), p_reminders: $("m_rem").checked });
    $("m_save").disabled = false;
    if (error) { mailMsg("m_msg", "err", IIC.friendlyError(error)); return; }
    mailMsg("m_msg", "ok", url ? "Settings saved. Send a test email to check." : "Settings saved. Emails stay off until you add the Apps Script link.");
  });
  $("m_test").addEventListener("click", async () => {
    mailMsg("m_msg", "", "Sending…");
    const { error } = await sb.rpc("admin_send_test_email");
    if (error) { mailMsg("m_msg", "err", IIC.friendlyError(error)); return; }
    mailMsg("m_msg", "ok", "Test email handed over. Check " + $("m_admin").value + " in a minute, and the log below.");
    setTimeout(loadLog, 4000);
  });
  $("m_remind").addEventListener("click", async () => {
    const b = $("m_remind");
    if (!b.classList.contains("armed")) {
      b.classList.add("armed"); b.textContent = "Click again to send";
      setTimeout(() => { b.classList.remove("armed"); b.textContent = "Send this month's reminders now"; }, 5000);
      return;
    }
    b.classList.remove("armed"); b.textContent = "Send this month's reminders now"; b.disabled = true;
    mailMsg("m_remMsg", "", "Sending…");
    const { data, error } = await sb.rpc("admin_send_reminders_now");
    b.disabled = false;
    if (error) { mailMsg("m_remMsg", "err", IIC.friendlyError(error)); return; }
    mailMsg("m_remMsg", "ok", data ? "Reminders sent to " + data + " department(s). A summary is on its way to the coordinator email." : "Every department has submitted this month. Only the summary email was sent.");
    setTimeout(loadLog, 4000);
  });
  $("m_logRefresh").addEventListener("click", loadLog);

  async function loadLog() {
    const { data, error } = await sb.rpc("admin_email_log", { p_limit: 100 });
    if (error) { $("m_log").innerHTML = '<div class="empty">Couldn\'t load the log. ' + esc(IIC.friendlyError(error)) + "</div>"; return; }
    if (!data || !data.length) { $("m_log").innerHTML = '<div class="empty">No emails yet. They appear here as reports are submitted and verified.</div>'; return; }
    const when = s => { try { return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
    const state = r => {
      if (/not sent|error:/.test(r.summary || "")) return '<span class="pill p-bad">Not sent</span>';
      if (r.status_code == null && !r.error_msg) return '<span class="pill p-warn">Sending / sent</span>';
      if (r.status_code >= 200 && r.status_code < 400) return '<span class="pill p-ok">Sent to Google</span>';
      return `<span class="pill p-bad" title="${esc(r.error_msg || "")}">Failed${r.status_code ? " (" + r.status_code + ")" : ""}</span>`;
    };
    $("m_log").innerHTML = `<table><thead><tr><th>When</th><th>Email</th><th>To</th><th>About</th><th>Status</th></tr></thead><tbody>` +
      data.map(r => `<tr><td style="white-space:nowrap">${when(r.created_at)}</td><td style="white-space:nowrap">${esc(KIND[r.kind] || r.kind)}</td>
        <td style="min-width:160px;overflow-wrap:anywhere">${r.recipients && r.recipients.length ? esc(r.recipients.join(", ")) : r.kind === "reminder" ? '<span class="hint">No faculty email – skipped</span>' : '<span class="hint">Coordinator (no faculty email)</span>'}</td>
        <td style="min-width:220px">${esc(r.summary)}</td><td>${state(r)}</td></tr>`).join("") + "</tbody></table>";
  }

  /* ---------- start ---------- */
  IIC.withTimeout(sb.auth.getSession(), 15000)
    .then(({ data, error }) => { if (error) throw error; return onSession(data.session); })
    .catch(e => window.IICShowProblem(e && e.code === "timeout" ? "Couldn't reach Supabase" : "Couldn't start the tracker",
      e && e.code === "timeout"
        ? "Supabase did not answer. Open supabase.com: if the project shows \"Paused\", click Restore. Also check the Project URL in config.js."
        : ((e && e.message) || String(e))));
  sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") showLogin(); });
})();
