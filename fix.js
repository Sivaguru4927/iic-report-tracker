// Corrected report: the "Submit the corrected report" button in the "returned for correction" email opens
// submit?fix=<report id>&t=<secret>. The department uploads the corrected Word file; it replaces the earlier
// file of the same report (resubmit_report in Supabase) and the report goes back to Pending Verification.
(function () {
  const { $, esc, sb } = IIC;
  const qs = new URLSearchParams(location.search);
  const id = qs.get("fix"), token = qs.get("t");
  if (!id || !token || !IIC.configured) return;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // correction mode: hide the normal form and the department history
  ["subForm", "s_done", "s_histBox"].forEach(x => { const el = $(x); if (el) el.hidden = true; });
  $("fixBox").hidden = false;
  const h1 = document.querySelector(".masthead h1"); if (h1) h1.textContent = "Corrected IIC Report";
  const bad = t => { $("f_bad").textContent = t; $("f_bad").hidden = false; $("f_body").hidden = true; };
  const msg = (k, t) => { const m = $("f_msg"); m.className = "msg" + (k ? " " + k : ""); m.textContent = t; };
  let rep = null, picked = null, formatted = false, busy = false;

  async function load() {
    if (!uuid.test(id) || !uuid.test(token)) return bad("This correction link is not complete. Open it again from the email, or contact the CII&E office.");
    const { data, error } = await sb.rpc("report_for_correction", { p_id: id, p_token: token });
    if (error) return bad(/report_for_correction/.test(error.message || "") ? "Corrections can't be uploaded yet. Please contact the CII&E office." : IIC.friendlyError(error));
    rep = (data || [])[0];
    if (!rep) return bad("This correction link is not valid. Use the latest email, or contact the CII&E office.");
    const ml = IIC.monthLabel ? IIC.monthLabel(rep.month) : rep.month;
    $("f_info").innerHTML = [["Department", rep.type + " – " + rep.dept], ["Faculty", rep.faculty], ["Quarter", rep.quarter], ["Month of activity", ml],
      ["Report title", rep.title], ["Current file", rep.file_name], ["Status", rep.verification], ["Corrections sent", rep.resubmit_count ? rep.resubmit_count + " time(s) before" : ""]]
      .filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join("");
    if (rep.remarks) { $("f_remarks").innerHTML = "<b>What to correct:</b> " + esc(rep.remarks); $("f_remarks").hidden = false; }
    if (rep.verification === "Verified") return bad("This report has already been verified. No correction is needed.");
    if (rep.verification === "Rejected") return bad("This report was not accepted. Please contact the CII&E office.");
    if (rep.verification === "Pending Verification" && rep.resubmit_count) {
      $("f_msg").className = "msg"; $("f_msg").textContent = "A corrected file was already sent and is waiting for verification. Uploading again replaces it.";
    }
    $("f_body").hidden = false;
  }

  function fileInfo() {
    $("f_fileInfo").innerHTML = picked ? "Ready to upload: <b>" + esc(picked.name) + "</b> (" + IIC.fmtSize(picked.size) + ")" : "No file chosen.";
  }
  let logoCache = null;
  async function logos() {
    if (logoCache) return logoCache;
    const r = await fetch("templates/IIC_Report_Template.docx"); if (!r.ok) return null;
    logoCache = await IICFormat.logosFromTemplate(await r.arrayBuffer()); return logoCache;
  }
  async function pick(f) {
    if (!f) return;
    $("f_fileInfo").textContent = "Checking " + f.name + "…";
    const err = await IIC.checkDocx(f);
    if (err) { $("f_file").value = ""; picked = null; fileInfo(); msg("err", err); return; }
    picked = f; formatted = false; msg("", ""); fileInfo();
    if (window.IICFormat && window.JSZip) {               // same house style as a new submission
      $("f_fileInfo").innerHTML = "Preparing <b>" + esc(f.name) + "</b>…";
      try {
        const { blob } = await IICFormat.format(f, await logos());
        if (picked !== f) return;
        if (blob.size <= IIC.MAX_BYTES) { picked = new File([blob], f.name, { type: IIC.DOCX_MIME }); formatted = true; }
      } catch (e) { /* upload as it is */ }
      fileInfo();
    }
  }
  $("f_file").addEventListener("change", e => pick(e.target.files[0]));
  const drop = $("f_drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); pick(e.dataTransfer.files[0]); });

  $("f_btn").addEventListener("click", async () => {
    if (busy || !rep) return;
    if (!picked) { msg("err", "Choose the corrected Word (.docx) file first."); return; }
    busy = true; $("f_btn").disabled = true; $("f_file").disabled = true;
    const path = id + "/corrected-" + Date.now() + "-" + IIC.safeName(picked.name);
    try {
      msg("", "Uploading " + picked.name + "… (please keep this page open)");
      let up;
      try { up = await IIC.withTimeout(sb.storage.from(IIC.BUCKET).upload(path, picked, { contentType: IIC.DOCX_MIME, upsert: false }), 120000); }
      catch (e) { throw new Error(e && e.code === "timeout" ? "The upload is taking too long. Check your internet connection and try again." : IIC.friendlyError(e)); }
      if (up.error) throw up.error;
      msg("", "Replacing the report file…");
      const r = await sb.rpc("resubmit_report", { p_id: id, p_token: token, p_file_path: path, p_file_name: picked.name, p_file_size: picked.size, p_formatted: formatted });
      if (r.error) throw r.error;
      $("f_body").hidden = true; $("f_done").hidden = false;
    } catch (err) {
      msg("err", IIC.friendlyError(err));
    } finally {
      busy = false; $("f_btn").disabled = false; $("f_file").disabled = false;
    }
  });

  load();
})();
