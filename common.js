// Shared helpers for the tracker (index.html) and the submission page (submit.html)
(function () {
  // Show any start-up problem on the page instead of leaving it blank
  function showProblem(title, detail) {
    const box = document.createElement("div");
    box.className = "box setup"; box.id = "startupProblem";
    box.innerHTML = "<h2></h2><p class='hint'></p>";
    box.querySelector("h2").textContent = title;
    box.querySelector("p").textContent = detail;
    const old = document.getElementById("startupProblem"); if (old) old.remove();
    (document.querySelector("main") || document.querySelector(".wrap") || document.body).appendChild(box);
  }
  window.IICShowProblem = showProblem;
  window.addEventListener("error", e => showProblem("Something went wrong while loading", (e.message || "Unknown error") +
    (e.filename ? " (" + e.filename.split("/").pop() + ", line " + e.lineno + ")" : "") + ". Send a screenshot of this box to the person who set up the tracker."));
  window.addEventListener("unhandledrejection", e => showProblem("Something went wrong while loading",
    String((e.reason && (e.reason.message || e.reason)) || "Unknown error") + ". Send a screenshot of this box to the person who set up the tracker."));

  const C = window.IIC_CONFIG || {};
  const url = String(C.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(C.SUPABASE_ANON_KEY || "").trim();
  let configured = !!(url && key && !/YOUR-PROJECT/.test(url) && !/YOUR-ANON/.test(key));
  let sb = null;
  if (!window.IIC_CONFIG) {
    configured = false;
    showProblem("config.js could not be read", "The file config.js is missing or has a typing mistake (check the quotes and commas). Copy it again from the setup folder, paste your Project URL and anon key between the quotes, and upload the folder again.");
  } else if (configured && !window.supabase) {
    configured = false;
    showProblem("Couldn't load the Supabase connection", "The browser could not download the Supabase library from cdn.jsdelivr.net. Check the internet connection, or try another network (some college networks block it).");
  } else if (configured && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    configured = false;
    showProblem("The Supabase URL in config.js looks wrong", "It should look like https://abcdefghijkl.supabase.co (from Supabase → Project Settings → API → Project URL). It is currently: " + url);
  } else if (configured) {
    try { sb = window.supabase.createClient(url, key); }
    catch (e) { configured = false; showProblem("Couldn't connect to Supabase", (e && e.message) || String(e)); }
  }

  const IIC = {
    configured,
    BUCKET: C.BUCKET || "iic-reports",
    sb,
    QS: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"],
    VERS: ["Pending Verification", "Verified", "Returned for Correction", "Rejected"],
    DOCX_MIME: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    MAX_BYTES: 5 * 1024 * 1024,

    $: id => document.getElementById(id),
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    byName: (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
    fmtSize: n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB",
    day: s => { try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return ""; } },
    qShort: q => String(q || "").replace("Quarter ", "Q"),

    // Months of a quarter in the IIC year (Sep–Aug): Q1 Sep–Nov, Q2 Dec–Feb, Q3 Mar–May, Q4 Jun–Aug.
    // Lists all three months for the current IIC year, then the previous year (for late reports).
    FULL_MONTHS: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthKey: d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
    monthLabel: k => { const m = /^(\d{4})-(\d{2})$/.exec(k || ""); return m ? IIC.FULL_MONTHS[+m[2] - 1] + " " + m[1] : ""; },
    monthsForQuarter(q) {
      const n = +String(q || "").slice(-1); if (!n) return [];
      const now = new Date(), cur = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, groups = [];
      for (const y of [cur, cur - 1]) {
        const keys = [];
        for (let i = 0; i < 3; i++) keys.push(IIC.monthKey(new Date(y, 8 + (n - 1) * 3 + i, 1)));
        if (keys.length) groups.push({ label: "IIC year " + y + "–" + String((y + 1) % 100).padStart(2, "0"), keys });
      }
      return groups;
    },
    // Reports for a month are accepted during the month and until the 10th of the next month
    GRACE_DAYS: 10,
    coordinator: false,   // true on the submission page when a coordinator is signed in (late entries allowed)
    monthWindow(k) {
      const m = /^(\d{4})-(\d{2})$/.exec(k || ""); if (!m) return null;
      const opens = new Date(+m[1], +m[2] - 1, 1), closes = new Date(+m[1], +m[2], IIC.GRACE_DAYS);   // last open day
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return { opens, closes, state: today < opens ? "future" : today > closes ? "closed" : "open",
               closesLabel: closes.getDate() + " " + IIC.FULL_MONTHS[closes.getMonth()] + " " + closes.getFullYear() };
    },
    // a report sent after the 10th of the following month is late (only the coordinator can add those)
    lateInfo(r) {
      const w = IIC.monthWindow(r && r.month), at = r && r.created_at ? new Date(r.created_at) : null;
      if (!w || !at) return { late: false, days: 0, deadline: w ? w.closesLabel : "" };
      const end = new Date(w.closes); end.setHours(23, 59, 59, 999);
      return { late: at > end, days: Math.max(Math.ceil((at - end) / 864e5), 0), deadline: w.closesLabel };
    },
    lateCell(r) {
      if (!r || !r.month) return '<span class="hint">—</span>';
      const x = IIC.lateInfo(r);
      return x.late ? `<span class="pill p-warn" title="Last date was ${IIC.esc(x.deadline)}">Late · ${x.days} day${x.days === 1 ? "" : "s"}</span><div class="hint">Due ${IIC.esc(x.deadline)}</div>`
                    : '<span class="pill p-ok">On time</span>';
    },
    windowMessage(k) {
      const w = IIC.monthWindow(k); if (!w || w.state === "open") return "";
      return w.state === "future" ? "Reports for " + IIC.monthLabel(k) + " can be submitted from 1 " + IIC.monthLabel(k) + "."
        : "The last date for " + IIC.monthLabel(k) + " reports was " + w.closesLabel + ". Late reports are uploaded only by the CII&E coordinator: email your report to iic@psgcas.ac.in, or explain the delay in field 11 (without a file).";
    },
    fillMonths(p) {
      const sel = IIC.$(p + "_month"), groups = IIC.monthsForQuarter(IIC.$(p + "_q").value);
      if (!groups.length) { sel.innerHTML = '<option value="">' + (IIC.$(p + "_q").value ? "No months yet" : "Select quarter first") + "</option>"; sel.disabled = true; return; }
      sel.innerHTML = '<option value="">Select…</option>' + groups.map(g => `<optgroup label="${g.label}">` +
        g.keys.map(k => { const w = IIC.monthWindow(k), tag = w.state === "open" ? " — open till " + w.closesLabel : w.state === "closed" ? " — closed" : " — not open yet";
          const t = w.state !== "closed" ? tag : IIC.coordinator ? " — closed" : " — closed (late: coordinator uploads)";
          return `<option value="${k}">${IIC.monthLabel(k)}${p === "s" ? t : ""}</option>`; }).join("") + "</optgroup>").join("");
      sel.disabled = false;
    },
    // IIC year Sep–Aug: Sep–Nov Q1, Dec–Feb Q2, Mar–May Q3, Jun–Aug Q4
    quarterForMonth: k => { const m = +String(k).slice(5, 7); return m ? "Quarter " + (Math.floor(((m - 9 + 12) % 12) / 3) + 1) : ""; },

    verClass: v => v === "Verified" ? "ok" : v === "Pending Verification" ? "warn" : "bad",
    verPill: v => `<span class="pill p-${IIC.verClass(v)}">${IIC.esc(v)}</span>`,
    subPill: s => `<span class="pill ${s === "Submitted" ? "p-ok" : s === "In Progress" ? "p-warn" : "p-bad"}">${IIC.esc(s)}</span>`,

    async checkDocx(f) {
      if (/\.doc$/i.test(f.name)) return "This is an old .doc file. Open it in Word, choose Save As → Word Document (.docx), and upload that.";
      if (!/\.docx$/i.test(f.name)) return "Only Word files (.docx) can be uploaded. " + f.name + " is not a Word document.";
      if (!f.size) return "This file is empty.";
      if (f.size > IIC.MAX_BYTES) return "This file is " + IIC.fmtSize(f.size) + ". The limit is 5 MB — compress the pictures in Word (File → Compress Pictures) and try again.";
      let h;
      try { h = new Uint8Array(await IIC.withTimeout(f.slice(0, 2).arrayBuffer(), 6000)); }
      catch (e) { return "Couldn't open this file. If it is kept in OneDrive or Google Drive, open it in Word once (or save a copy on your computer) and choose it again."; }
      if (h[0] !== 0x50 || h[1] !== 0x4B) return "This file has a .docx name but isn't a valid Word document.";
      return "";
    },
    withTimeout: (promise, ms) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), ms))]),
    safeName: n => n.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-120) || "report.docx",

    saveBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    },

    // Dependent dropdowns: Aided/SF → Department → Faculty → Mobile
    deptNamesFor: (depts, type) => [...new Set(depts.filter(d => d.type === type).map(d => d.name))].sort(IIC.byName),
    facultyFor: (depts, type, name) => depts.filter(d => d.type === type && d.name === name).sort((a, b) => IIC.byName(a.faculty, b.faculty)),
    fillDept(depts, p, keep) {
      const t = IIC.$(p + "_type").value, sel = IIC.$(p + "_dept");
      if (!t) { sel.innerHTML = '<option value="">Select Aided / SF first</option>'; sel.disabled = true; IIC.fillFac(depts, p); return; }
      const names = IIC.deptNamesFor(depts, t);
      sel.innerHTML = '<option value="">' + (names.length ? "Select department…" : "No " + t + " departments added yet") + "</option>" +
        names.map(n => `<option value="${IIC.esc(n)}">${IIC.esc(n)}</option>`).join("");
      sel.disabled = !names.length;
      if (keep && names.includes(keep)) sel.value = keep;
      IIC.fillFac(depts, p);
    },
    fillFac(depts, p, keepName) {
      const t = IIC.$(p + "_type").value, n = IIC.$(p + "_dept").value, sel = IIC.$(p + "_fac");
      if (!n) { sel.innerHTML = '<option value="">Select department first</option>'; sel.disabled = true; IIC.fillMob(depts, p); return; }
      const f = IIC.facultyFor(depts, t, n);
      sel.innerHTML = (f.length > 1 ? '<option value="">Select faculty…</option>' : "") +
        f.map(x => `<option value="${IIC.esc(x.id)}">${IIC.esc(x.faculty)}</option>`).join("");
      sel.disabled = false;
      if (keepName) { const m = f.find(x => x.faculty === keepName); if (m) sel.value = m.id; }
      IIC.fillMob(depts, p);
    },
    fillMob(depts, p) {
      const d = depts.find(x => x.id === IIC.$(p + "_fac").value);
      IIC.$(p + "_mob").value = d ? d.mobile : "";
      const em = IIC.$(p + "_email");
      if (em) {
        const onRecord = d && d.email ? d.email : "";
        em.readOnly = !d || !!onRecord;
        em.value = onRecord;
        em.placeholder = !d ? "Fills in from faculty" : onRecord ? "" : "Enter your email";
        const hint = IIC.$(p + "_emailHint");
        if (hint) hint.hidden = !(d && !onRecord);
      }
    },

    friendlyError(e) {
      const m = (e && (e.message || e.error_description || e.error)) || "";
      if (/Failed to fetch|NetworkError/i.test(m)) return "Couldn't reach the server. Check your internet connection and try again.";
      if (/mime type|invalid_mime/i.test(m)) return "Only Word (.docx) files are accepted.";
      if (/exceeded the maximum|too large|Payload too large/i.test(m)) return "The file is larger than 5 MB.";
      if (/duplicate key/i.test(m)) return "That entry already exists.";
      if (/iic_activity|compliance|schema cache|reports_iic_activity_check/i.test(m)) return "The database needs the latest update. Ask the CII&E coordinator to run supabase-update-dashboard.sql in Supabase.";
      return m || "Something went wrong. Please try again.";
    },

    setupNotice(container) {
      if (document.getElementById("startupProblem")) return;   // a more specific message is already shown
      container.innerHTML = `<div class="box setup"><h2>Setup needed</h2>
        <p class="hint">This site isn't connected to Supabase yet. Open <b>config.js</b>, paste your Supabase Project URL and anon key, and deploy again. See SETUP.md.</p></div>`;
    }
  };
  window.IIC = IIC;
})();
