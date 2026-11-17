// Department submission page: fields 1–7 → Supabase
(function () {
  const { $, esc, sb } = IIC;
  if (!IIC.configured) { IIC.setupNotice($("main")); return; }

  let depts = [], hist = [], picked = null, lastId = null, pollTimer = null, fmtNote = "", wasFormatted = false;

  /* ---------- departments ---------- */
  async function loadDepts() {
    const { data, error } = await sb.from("departments").select("id,type,name,faculty,mobile,email");
    if (error) { msg("err", IIC.friendlyError(error)); return; }
    depts = data || [];
    $("s_noDept").hidden = depts.length > 0;
    const t = $("s_type").value, d = $("s_dept").value, f = $("s_fac").selectedOptions[0]?.textContent;
    if (t) { IIC.fillDept(depts, "s", d); if (d) IIC.fillFac(depts, "s", f); }
  }
  // Department: type any part of the name (or a faculty name) to find it
  const deptItems = () => {
    const m = new Map();
    depts.forEach(d => { const k = d.type + "|" + d.name; if (!m.has(k)) m.set(k, { type: d.type, name: d.name, faculty: [] }); m.get(k).faculty.push(d.faculty); });
    return [...m.values()];
  };
  const combo = makeDeptCombo({
    input: $("s_deptSearch"), list: $("s_deptList"), getItems: deptItems,
    getType: () => $("s_type").value,
    getSelected: () => $("s_dept").value ? { type: $("s_type").value, name: $("s_dept").value } : null,
    onPick: d => {
      if ($("s_type").value !== d.type) $("s_type").value = d.type;
      IIC.fillDept(depts, "s", d.name);
      loadHist();
    }
  });
  $("s_type").addEventListener("change", () => { IIC.fillDept(depts, "s"); combo.clear(); loadHist(); });
  $("s_dept").addEventListener("change", () => { IIC.fillFac(depts, "s"); loadHist(); });

  $("s_fac").addEventListener("change", () => IIC.fillMob(depts, "s"));
  const fillAct = () => { const q = $("s_q").value, a = $("s_act");
    a.innerHTML = q ? IICFramework.optionsFor(q) : '<option value="">Select quarter first</option>'; a.disabled = !q; };
  $("s_q").addEventListener("change", () => { IIC.fillMonths("s"); fillAct(); });

  /* ---------- this department's reports ---------- */
  async function loadHist() {
    const t = $("s_type").value, n = $("s_dept").value, box = $("s_histBox");
    if (!t || !n) { box.hidden = true; hist = []; renderDone(); return; }
    box.hidden = false;
    $("s_histTitle").textContent = "Reports from " + n + " (" + t + ")";
    const { data, error } = await sb.rpc("department_reports", { p_type: t, p_dept: n });
    if (error) { $("s_hist").innerHTML = '<div class="empty">Couldn\'t load reports. ' + esc(IIC.friendlyError(error)) + "</div>"; return; }
    hist = data || [];
    renderHist(); renderDone();
    const qr = await sb.rpc("department_queries", { p_type: t, p_dept: n });
    const qs = qr.error ? [] : (qr.data || []);
    $("s_qTitle").hidden = !qs.length;
    $("s_qhist").innerHTML = qs.length ? `<table><thead><tr><th>Sent on</th><th>Quarter</th><th>Month</th><th>Faculty</th><th>Query</th><th>Status</th><th>Reply from CII&amp;E</th></tr></thead><tbody>` +
      qs.map(q => `<tr><td style="white-space:nowrap">${IIC.day(q.created_at)}</td><td>${esc(IIC.qShort(q.quarter))}</td><td style="white-space:nowrap">${esc(IIC.monthLabel(q.month) || "—")}</td>
        <td>${esc(q.faculty)}</td><td style="min-width:180px">${esc(q.query)}</td><td>${qPill(q.status)}</td><td style="min-width:160px">${esc(q.reply || "—")}</td></tr>`).join("") + "</tbody></table>" : "";
  }
  let queryMode = false;
  const qPill = s => `<span class="pill ${s === "Resolved" ? "p-ok" : s === "In Progress" ? "p-warn" : "p-bad"}">${esc(s)}</span>`;
  function renderHist() {
    if (!hist.length) { $("s_hist").innerHTML = '<div class="empty">No reports from this department yet.</div>'; return; }
    $("s_hist").innerHTML = `<table><thead><tr><th>Quarter</th><th>Month</th><th>Report title</th><th>Faculty</th><th>File</th><th>Submitted on</th><th>Late submission</th><th>Your query</th><th>Verification</th><th>Remarks</th></tr></thead><tbody>` +
      hist.map(r => `<tr><td style="white-space:nowrap">${esc(IIC.qShort(r.quarter))}</td><td style="white-space:nowrap">${esc(IIC.monthLabel(r.month) || "—")}</td><td style="min-width:180px">${esc(r.title)}</td><td>${esc(r.faculty)}</td>
        <td><div class="filelink"><span title="${esc(r.file_name)}">${esc(r.file_name)}</span></div></td>
        <td style="white-space:nowrap">${IIC.day(r.created_at)}</td><td style="white-space:nowrap">${IIC.lateCell(r)}</td><td style="min-width:140px">${esc(r.query || "—")}</td><td>${IIC.verPill(r.verification)}</td><td style="min-width:140px">${esc(r.remarks)}</td></tr>`).join("") +
      "</tbody></table>";
  }
  $("s_refresh").addEventListener("click", loadHist);

  /* ---------- live status on the confirmation card ---------- */
  function renderDone() {
    const el = $("s_doneStatus"), r = hist.find(x => x.id === lastId);
    if (!lastId) { if (!queryMode) el.textContent = ""; return; }
    const v = r ? r.verification : "Pending Verification";
    const note = v === "Verified" ? "This report has been verified."
      : v === "Pending Verification" ? "The CII&E team will verify it. This status refreshes on its own."
      : "Please correct the report and submit it again.";
    el.innerHTML = "Status: " + IIC.verPill(v) + " " + esc(note) + (r && r.remarks ? "<br>Remarks: <b>" + esc(r.remarks) + "</b>" : "");
  }
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { if (!document.hidden && lastId) loadHist(); }, 30000);
  }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  /* ---------- file picker ---------- */
  function fileInfo() {
    if (picked) {
      $("s_fileInfo").innerHTML = "Ready to upload: <b>" + esc(picked.name) + "</b> (" + IIC.fmtSize(picked.size) + ")";
      $("s_clear").hidden = false;
    }
    else { $("s_fileInfo").textContent = "No file chosen."; $("s_clear").hidden = true; }
  }
  async function pick(f) {
    if (!f) return;
    $("s_fileInfo").textContent = "Checking " + f.name + "…";
    const err = await IIC.checkDocx(f);
    if (err) { $("s_file").value = ""; picked = null; fileInfo(); msg("err", err); return; }
    picked = f; fmtNote = ""; wasFormatted = false; msg("", ""); fileInfo();
    // AI formatting agent: apply the CII&E report style (Times New Roman 16/14/12, colours, logos) before upload
    if (window.IICFormat && window.JSZip) {
      $("s_fileInfo").innerHTML = "Preparing <b>" + esc(f.name) + "</b>…";
      try {
        const logos = await reportLogos();
        const { blob, info } = await IICFormat.format(f, logos);
        if (picked !== f) return;                                  // user picked another file meanwhile
        if (blob.size > IIC.MAX_BYTES) throw new Error("formatted file over 5 MB");
        picked = new File([blob], f.name, { type: IIC.DOCX_MIME }); wasFormatted = true;
        fmtNote = "✓ Formatted to the CII&amp;E style: Times New Roman, headings 16/14 pt, body 12 pt justified, letterhead colours" +
          (info.logosAdded.length ? ", " + (info.logosAdded.length === 2 ? "PSGCAS and IIC logos" : info.logosAdded[0] === "psg" ? "PSGCAS logo" : "IIC logo") + " added" : "") + ".";
      } catch (e) {
        if (picked !== f) return;
        fmtNote = "The file couldn't be formatted automatically (" + esc(e.message || "error") + "); it will be uploaded as it is.";
      }
      fileInfo();
    }
  }
  let logoCache = null;
  async function reportLogos() {           // the PSGCAS and IIC logos come from the IIC report template on this site
    if (logoCache) return logoCache;
    const r = await fetch("templates/IIC_Report_Template.docx"); if (!r.ok) return null;
    logoCache = await IICFormat.logosFromTemplate(await r.arrayBuffer()); return logoCache;
  }
  $("s_file").addEventListener("change", e => pick(e.target.files[0]));
  $("s_clear").addEventListener("click", () => { picked = null; fmtNote = ""; $("s_file").value = ""; fileInfo(); });
  const drop = $("s_drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); pick(e.dataTransfer.files[0]); });

  function msg(kind, text) { const m = $("s_msg"); m.className = "msg" + (kind ? " " + kind : ""); m.textContent = text; }

  /* ---------- submit ---------- */
  $("subForm").addEventListener("submit", async e => {
    e.preventDefault();
    const fac = depts.find(x => x.id === $("s_fac").value);
    const miss = [];
    if (!$("s_type").value) miss.push("Aided or SF");
    if (!$("s_dept").value) miss.push("Department");
    if (!fac) miss.push("Faculty name");
    const email = $("s_email").value.trim().toLowerCase();
    if (fac && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) miss.push("Email");
    if (!$("s_q").value) miss.push("Quarter");
    if (!$("s_month").value) miss.push("Month of activity");
    const title = $("s_title").value.trim(), query = $("s_query").value.trim();
    if (miss.length) { msg("err", "Please fill: " + miss.join(", ") + "."); return; }
    // Either the report (title + file), or a query explaining why it can't be submitted
    if (!picked && !query) {
      msg("err", title ? "Attach the Word file (field 10), or describe your difficulty in field 11."
                       : "Attach your report (fields 8 to 10), or describe your difficulty in field 11.");
      return;
    }
    if (picked && !title) { msg("err", "Please fill: Report title."); return; }
    if (picked && !$("s_act").value) { msg("err", "Please choose the Activity type (field 8)."); return; }
    const win = IIC.monthWindow($("s_month").value), late = win && win.state === "closed";
    // the deadline doesn't apply to a signed-in coordinator adding a previous month's report
    if (picked && IIC.windowMessage($("s_month").value) && !(IIC.coordinator && late)) { msg("err", IIC.windowMessage($("s_month").value)); return; }

    const base = { type: $("s_type").value, dept: $("s_dept").value, faculty: fac.faculty, mobile: fac.mobile, email,
                   month: $("s_month").value, quarter: $("s_q").value };
    const showDone = (heading, rows) => {
      $("s_doneTitle").textContent = heading;
      $("s_doneList").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
      $("subForm").hidden = true; $("s_done").hidden = false; window.scrollTo({ top: 0 });
    };
    const who = [["Aided / SF", base.type], ["Department", base.dept], ["Faculty", base.faculty], ["Mobile", base.mobile],
                 ["Email", base.email], ["Quarter", base.quarter], ["Month of activity", IIC.monthLabel(base.month)]];

    // ---- query only (no report) ----
    if (!picked) {
      $("s_btn").disabled = true; $("s_btn").textContent = "Sending…";
      try {
        const ins = await sb.from("queries").insert({ ...base, title: title || null, query });
        if (ins.error) throw ins.error;
        msg("", "");
        lastId = null; queryMode = true;
        showDone("Query sent", [...who, ...(title ? [["Report title", title]] : []), ["Your query", query]]);
        $("s_doneStatus").innerHTML = "Status: " + qPill("Open") +
          " The CII&amp;E team will get back to you by email. Once it's sorted out, submit your report here.";
        loadHist();
      } catch (err) { msg("err", IIC.friendlyError(err)); }
      finally { $("s_btn").disabled = false; $("s_btn").textContent = "Submit"; }
      return;
    }

    // ---- report (with an optional query) ----
    const id = crypto.randomUUID();
    const path = id + "/" + IIC.safeName(picked.name);
    const rec = { id, ...base, title, file_path: path, file_name: picked.name, file_size: picked.size, query, iic_activity: $("s_act").value };
    if (wasFormatted) rec.formatted = true;
    if (IIC.coordinator && late) rec.remarks = "Late entry added by the CII&E coordinator on " + IIC.day(new Date().toISOString()) + ".";
    $("s_btn").disabled = true; $("s_file").disabled = true; $("s_btn").textContent = "Uploading…";
    try {
      msg("", "Uploading " + picked.name + "… (please keep this page open)");
      let up;
      try { up = await IIC.withTimeout(sb.storage.from(IIC.BUCKET).upload(path, picked, { contentType: IIC.DOCX_MIME, upsert: false }), 120000); }
      catch (e) { throw new Error(e && e.code === "timeout" ? "The upload is taking too long. Check your internet connection and press Submit again." : IIC.friendlyError(e)); }
      if (up.error) throw up.error;
      msg("", "Saving report…");
      const ins = await sb.from("reports").insert(rec);   // no .select(): departments can't read the table
      if (ins.error) throw ins.error;
      if (query) await sb.from("queries").insert({ ...base, report_id: id, title, query });   // also listed in the Queries tab

      msg("", "");
      showDone("Report submitted", [...who, ["Activity type", IICFramework.labelOf(rec.iic_activity)], ["Report title", rec.title], ["File", rec.file_name], ["Queries / Difficulties", rec.query || "—"]]);
      lastId = id; queryMode = false; renderDone();
      loadHist(); startPolling();
    } catch (err) {
      msg("err", IIC.friendlyError(err));
    } finally {
      $("s_btn").disabled = false; $("s_file").disabled = false; $("s_btn").textContent = "Submit";
    }
  });

  $("s_another").addEventListener("click", () => {
    lastId = null; stopPolling(); picked = null; fmtNote = ""; wasFormatted = false; $("s_file").value = ""; $("s_title").value = ""; $("s_query").value = ""; $("s_q").value = ""; IIC.fillMonths("s"); fillAct(); fileInfo();
    $("s_done").hidden = true; $("subForm").hidden = false; $("s_title").focus(); msg("", ""); queryMode = false;
  });

  loadDepts();

  // Coordinator mode: signed in to the tracker in this browser → previous months' reports can be added
  (async () => {
    try {
      const { data } = await sb.auth.getSession(); const s = data && data.session; if (!s) return;
      const ok = await sb.rpc("is_admin"); if (ok.error || !ok.data) return;
      IIC.coordinator = true;
      if ($("s_q").value) { const m = $("s_month").value; IIC.fillMonths("s"); $("s_month").value = m; }
    } catch (e) { /* not signed in: normal department page */ }
  })();
})();
