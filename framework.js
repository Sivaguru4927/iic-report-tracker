// IIC 9.0 calendar (mandatory activities + important days), NISP and NIRF-Innovation status.
// Sources: "IIC 9.0 Calendar Activities for Academic Year 2026-27" and "NIRF India Rankings 2025 – Ranking
// Metrics for Innovation Rankings" (6 parameters). The NISP list follows the National Innovation and Start-up Policy 2019.
// The Dashboard shows each area as a gap analysis: score, monthly chart, "where to concentrate", then the detail table.
// Shared by the submission page (activity dropdown) and the Dashboard (status tables).
(function () {
  const L12 = "1 or 2", L34 = "3 or 4";
  const CAL = {
    "Quarter 1": { thrust: "Inspiration, Motivation and Ideation", items: [
      ["Workshop on Problem Solving and Ideation", L12],
      ["My Story / Motivational Expert Session by Successful Innovators & Entrepreneurs", L12],
      ["Workshop on AI Tools and Emerging Technologies for Innovators and Entrepreneurs", L12],
      ["IPR Basics for Innovators & Entrepreneurs", L12],
      ["Field Visit on Identifying Problems and Session on Achieving Problem–Solution Fit", L34],
      ["Inter/Intra Institutional Hackathon / Idea Challenge and Demo Day / Idea Showcase", L34]] },
    "Quarter 2": { thrust: "Validation and Concept Development", items: [
      ["Workshop on Design Thinking, Critical Thinking, Innovation Design and Rapid Prototyping", L12],
      ["Innovation & Entrepreneurship Outreach Program in Schools", L12],
      ["Session on Technology Readiness Level (TRL), MRL, IRL", L12],
      ["Workshop: Marketing Research and Marketing Strategies for Innovators, Entrepreneurs & Start-ups", L12],
      ["Field/Exposure Visit to Pre-incubation Units (AICTE Idea Lab, Fab Lab, MSME clusters)", L34],
      ["Inter/Intra Institutional Innovation Competition / Hackathon and Exhibition of Innovations / Prototypes", L34]] },
    "Quarter 3": { thrust: "Prototype, Design and Business Model Development", items: [
      ["Workshop on Product–Market Fit; Prototype / Process Design and MVP Development", L12],
      ["Session/Workshop on Business Model Canvas (BMC) & Business Model Fit", L12],
      ["Field/Exposure Visit to Incubation Units / Patent Facilitation / Tech Transfer Centres", L34],
      ["Session on Start-up Legal & Ethical Steps", L12],
      ["Workshop on Raising Capital and Finance Management for Start-ups", L12],
      ["Inter/Intra Institutional B-Plan Competition, Demonstration of Business Plans & Mentor Linkages", L34]] },
    "Quarter 4": { thrust: "Start-up Ecosystem and Scale Up", items: [
      ["Workshop on Prototype Validation, Value Proposition, Business Model Fit and Lean Start-up & MVP", L12],
      ["Workshop on Angel Investment / VC Funding Opportunities, Fundraising & Investor Pitch Preparation", L12],
      ["Session on Accelerators / Incubation Opportunities", L12],
      ["Panel Discussion with Regional / National Start-up Ecosystem Enablers", L12],
      ["Workshop: IP Management for Start-ups, IP Commercialization and Tech-Transfer", L34],
      ["Inter/Intra Institutional Start-up Competition, Demonstration of Start-ups & Mentor Linkages", L34]] }
  };
  // [MM-DD, name, quarter]
  const DAYS = [
    ["10-15", "Institution's Innovation Day (Dr APJ Abdul Kalam's birth anniversary)", "Quarter 1"],
    ["11-09", "National Entrepreneurship Day", "Quarter 1"],
    ["11-11", "National Education Day", "Quarter 1"],
    ["12-02", "National Pollution Control Day", "Quarter 2"],
    ["12-14", "National Energy Conservation Day", "Quarter 2"],
    ["01-12", "National Youth Day", "Quarter 2"],
    ["01-16", "National Startup Day", "Quarter 2"],
    ["02-28", "National Science Day", "Quarter 2"],
    ["03-08", "International Women's Day", "Quarter 3"],
    ["04-21", "World Creativity and Innovation Day", "Quarter 3"],
    ["04-26", "World Intellectual Property Day", "Quarter 3"],
    ["05-11", "National Technology Day", "Quarter 3"],
    ["06-05", "World Environment Day", "Quarter 4"],
    ["07-29", "Anniversary of National Education Policy (NEP) 2020", "Quarter 4"],
    ["08-15", "Independence Day", "Quarter 4"],
    ["08-21", "World Entrepreneurs Day", "Quarter 4"]
  ];
  // NIRF Innovation Rankings 2025 (Ministry of Education): [code, parameter, weight, [[code, component, marks, what to count], …]]
  // Each parameter is out of 100 marks; overall = Σ parameter marks × weight.
  const NIRF = [
    ["FSI", "Financial Support for Innovation", 0.25, [
      ["FSI.SU", "Ventures / start-ups recognised by DPIIT / Startup India (SU)", 20, "No. recognised in the previous 3 years"],
      ["FSI.VCI", "Ventures / start-ups that received VC investment (VCI)", 20, "Average VC investment ÷ no. of start-ups funded (3 yrs)"],
      ["FSI.SF", "Seed funding received from Government organisations (SF)", 20, "Average seed funding ÷ no. of start-ups funded (3 yrs)"],
      ["FSI.FDII", "FDI investment in ventures / start-ups (FDII)", 20, "Average FDI ÷ no. of start-ups with FDI (3 yrs)"],
      ["FSI.IG", "Innovation grant received from Government organisations (IG)", 20, "Average innovation grant received (3 yrs)"]]],
    ["IA", "Innovation Achievements", 0.15, [
      ["IA.ITRL", "Innovations at various Technology Readiness Levels (ITRL)", 40, "No. of innovations at TRL stages"],
      ["IA.NVS", "Ventures / start-ups with a turnover of ₹50 lakh (NVS)", 40, "Ventures at ₹50 lakh turnover ÷ total ventures"],
      ["IA.AFF", "Alumni founders of Forbes / Fortune 500 companies (AFF)", 20, "No. of such alumni founders"]]],
    ["RIO", "Research and Innovation Output in SCI", 0.30, [
      ["RIO.PU", "Publications in SCI (PU)", 25, "Weighted publications ÷ faculty (FSR 1:15)"],
      ["RIO.CI", "Quality of publications in SCI – citations (CI)", 25, "Citation count (3 yrs) ÷ faculty"],
      ["RIO.IPP", "Patents published (IPR – IPP)", 15, "No. published in the previous 3 years"],
      ["RIO.IPG", "Patents granted (IPR – IPG)", 25, "No. granted in the previous 3 years"],
      ["RIO.PCTT", "Patent commercialisation & technology transfer (PCTT)", 10, "No. commercialised / transferred (3 yrs)"]]],
    ["PII", "Pre-Incubation and Incubation", 0.10, [
      ["PII.PI", "Pre-incubation: expenditure and participations (PI)", 30, "Average pre-incubation spend ÷ no. of participations (3 yrs)"],
      ["PII.IE", "Incubation expenditure (IIE – IE)", 15, "Average incubation expenditure (3 yrs)"],
      ["PII.II", "Incubation income (IIE – II)", 15, "Average income from incubation (3 yrs)"],
      ["PII.FDP", "FDPs in Innovation, Entrepreneurship and IPR (FDP)", 20, "No. of FDPs in the previous 3 years"],
      ["PII.CCI", "Credit courses in Innovation offered (CCI)", 20, "No. of credit courses in the previous 3 years"]]],
    ["AIE", "Adoption of I&E Policy in HEIs", 0.10, [
      ["AIE.NISP", "Registered on the NISP portal for I&E policy adoption (NISP)", 20, "Registration on the NISP portal"],
      ["AIE.IIC", "Annual performance of the Institution's Innovation Council (IICs)", 30, "IIC star rating / score for the year"],
      ["AIE.KAPILA", "Participation in the KAPILA portal (KAPILA)", 20, "IP applications / awareness via KAPILA"],
      ["AIE.SIH", "Participation in Smart India Hackathon (SIH)", 30, "Teams registered / shortlisted / winners"]]],
    ["PR", "Perception", 0.10, [
      ["PR.PR", "Peer perception: academic peers and employers (PR)", 100, "NIRF survey; build visibility with peers and employers"]]]
  ];
  // NISP 2019: [code, item]
  const NISP = [
    ["N1", "Registered on the NISP portal (nisp.mic.gov.in)"],
    ["N2", "I&E policy formulated and approved by the Governing Body"],
    ["N3", "Policy implemented and implementation details uploaded on the NISP portal"],
    ["N4", "Strategy and governance: I&E in the institution's vision and mission; dedicated I&E budget (at least 1% of the total budget)"],
    ["N5", "Pre-incubation and incubation support available to students and faculty"],
    ["N6", "IP ownership and revenue-sharing norms for innovations and technologies developed at the institution"],
    ["N7", "Norms for faculty and student start-ups (leave / semester break, equity, credits for start-up work)"],
    ["N8", "Pedagogy and learning: credit / elective courses on innovation and entrepreneurship"],
    ["N9", "Collaboration, co-creation and knowledge exchange with industry and ecosystem partners"],
    ["N10", "Annual entrepreneurial impact assessment of I&E activities"]
  ];
  // Prescribed R&D activities: [code, sub theme, title, description, level / duration]
  const RND = [
    ["R1", "R&D Awareness and Capacity Building", "Faculty & Student R&D Orientation Program", "Workshops or seminars introducing R&D processes, research ethics, funding sources and global best practices", "Half/Full day"],
    ["R2", "R&D Awareness and Capacity Building", "Annual Research Conclave/Symposium", "Showcase ongoing and completed research projects across departments and facilitate knowledge exchange", "Half/Full day"],
    ["R3", "R&D Awareness and Capacity Building", "Training on Technology Readiness Level (TRL) and Manufacturing Readiness Level (MRL)", "Training on TRL & MRL for researchers and inventors & ISO certification procedures", "Half/Full day"],
    ["R4", "R&D Awareness and Capacity Building", "Training on Technology Commercialisation, Licensing and Transfer Practices & Strategy", "Training for researchers and inventors", "Half/Full day"],
    ["R5", "Cross Disciplinary Thematic Research and Output Enhancement", "Thematic Research based Hackathon/Ideathon in Campus", "Cross-disciplinary hackathons on nationally and industrially relevant problems", "Half/Full day"],
    ["R6", "Cross Disciplinary Thematic Research and Output Enhancement", "Sponsored/Seed Grant Proposal Writing Workshops", "Guidance and support for preparing and submitting research proposals to funding agencies", "Half/Full day"],
    ["R7", "Intellectual Property (IP) Generation and Commercialization", "IP Awareness and Patent Filing Workshops", "Training on patents, copyrights, trademarks and research publication ethics, including step-by-step IP filing", "Half/Full day"],
    ["R8", "Intellectual Property (IP) Generation and Commercialization", "Innovation to Commercialization Boot camps", "Boot camps guiding researchers from lab to market, nurturing entrepreneurial mindsets", "Half/Full day"],
    ["R9", "Promotion of Deep-Tech based Research & Innovation", "Deep-Tech Innovation Challenge", "Proposals for emerging technology solutions (AI, robotics, clean tech, IoT, biotech, etc.), seed grants and incubation support", "Half/Full day"],
    ["R10", "Promotion of Deep-Tech based Research & Innovation", "Prototype Development & Validation Clinic", "Clinics for converting ideas into working prototypes and technical validation with experts", "Half/Full day"],
    ["R11", "Strengthening the Industry-Academia for R&D Collaboration", "Industry R&D Roundtables/Meetups", "Meetings with industry partners on research collaboration, consultancy and internships", "Half/Full day"],
    ["R12", "Strengthening the Industry-Academia for R&D Collaboration", "Problem Statement Database & Collaborative Research Projects", "Database of real-world industry problems; collaborative research projects with students and faculty", "Half/Full day"],
    ["R13", "Research Publication and Dissemination", "Research Paper Writing and Journal Publication Support Workshops", "Expert-led training on scientific writing, selecting journals, peer review and avoiding predatory publications", "Half/Full day"],
    ["R14", "Research Publication and Dissemination", "Publish of Annual R&D Newsletter or Research Digest", "Digital/print newsletter on research achievements, collaborations, IP filings and success stories", "Published Newsletter"],
    ["R15", "Synergizing & Synchronization of R&D Facilities at Intra & Inter Institutional", "Departmental R&D Facility Mapping and Resource Sharing Policy", "Survey and document R&D infrastructure, equipment and expertise; promote shared use", "Policy Document"],
    ["R16", "Synergizing & Synchronization of R&D Facilities at Intra & Inter Institutional", "Making Centralized Research Equipment Portal and Access to Facilities", "Online portal of available instruments/facilities and booking procedures", "Online Portal with Equipment List and Service"],
    ["R17", "Monitoring, Evaluation, and Recognition of Research", "Regular R&D Review Meetings and Progress Tracking", "Monthly/quarterly review meetings to monitor ongoing projects and resolve bottlenecks", "Review Meetings"],
    ["R18", "Monitoring, Evaluation, and Recognition of Research", "Celebrate an Annual Research Awards and Recognition Ceremony", "Awards for outstanding research papers, patents, impactful projects and collaborative efforts", "Half/Full day"]
  ];
  const STATUSES = ["Not started", "In progress", "Achieved", "Not applicable"];
  const FACTOR = { "Achieved": 1, "In progress": 0.5, "Not started": 0 };

  // activity types stored on a report:
  //   cal|Quarter 1|3 (IIC calendar) · day|10-15 (celebration) · nirf|RIO.IPG (NIRF component) · nisp|N3 (NISP item) · other
  const calKey = (q, i) => "cal|" + q + "|" + (i + 1);
  const dayKey = md => "day|" + md;
  const nirfKey = c => "nirf|" + c;
  const nispKey = c => "nisp|" + c;
  const rndKey = c => "rnd|" + c;
  const nirfComp = c => { for (const [pc, pn, w, list] of NIRF) { const x = list.find(l => l[0] === c); if (x) return { pc, pn, w, x }; } return null; };
  function labelOf(key) {
    if (!key) return "";
    if (key === "other") return "Other activity";
    const p = key.split("|");
    if (p[0] === "cal" && CAL[p[1]]) { const it = CAL[p[1]].items[+p[2] - 1]; return it ? "IIC calendar " + p[1].replace("Quarter ", "Q") + "." + p[2] + ": " + it[0] : ""; }
    if (p[0] === "day") { const d = DAYS.find(x => x[0] === p[1]); return d ? "Celebration: " + d[1] : ""; }
    if (p[0] === "nirf") { const f = nirfComp(p[1]); return f ? "NIRF Innovation " + f.pc + ": " + f.x[1] : ""; }
    if (p[0] === "nisp") { const i = NISP.findIndex(x => x[0] === p[1]); return i >= 0 ? "NISP " + (i + 1) + ": " + NISP[i][1] : ""; }
    if (p[0] === "rnd") { const r = RND.find(x => x[0] === p[1]); return r ? "R&D activity " + p[1].slice(1) + ": " + r[2] : ""; }
    return "";
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayLabel = md => +md.slice(3) + " " + MON[+md.slice(0, 2) - 1];
  const opt = (k, text, selected) => `<option value="${k}"${k === selected ? " selected" : ""}>${text}</option>`;
  // NIRF Innovation and NISP groups (same in every quarter)
  const nirfNispGroups = selected =>
    NIRF.map(([pc, pn, w, list]) => `<optgroup label="NIRF Innovation – ${pc}: ${esc(pn)}">` + list.map(([c, t]) => opt(nirfKey(c), `${c} · ${esc(t)}`, selected)).join("") + "</optgroup>").join("") +
    '<optgroup label="NISP – National Innovation and Start-up Policy">' + NISP.map(([c, t], i) => opt(nispKey(c), `NISP ${i + 1} · ${esc(t)}`, selected)).join("") + "</optgroup>" +
    [...new Set(RND.map(r => r[1]))].map(th => `<optgroup label="Prescribed R&amp;D activities – ${esc(th)}">` +
      RND.filter(r => r[1] === th).map(([c, , t, , lv]) => opt(rndKey(c), `R&amp;D ${c.slice(1)} · ${esc(t)} (${esc(lv)})`, selected)).join("") + "</optgroup>").join("");

  // <option>s for the submission form's "Activity type" dropdown, for the chosen quarter
  function optionsFor(quarter) {
    const cal = CAL[quarter];
    let html = '<option value="">Select…</option>';
    if (cal) {
      html += `<optgroup label="IIC calendar – ${quarter} (mandatory): ${esc(cal.thrust)}">` +
        cal.items.map((it, i) => `<option value="${calKey(quarter, i)}">${quarter.replace("Quarter ", "Q")}.${i + 1} ${esc(it[0])} (Level ${it[1]})</option>`).join("") + "</optgroup>";
      const days = DAYS.filter(d => d[2] === quarter);
      if (days.length) html += `<optgroup label="IIC important day celebrations – ${quarter}">` +
        days.map(d => `<option value="${dayKey(d[0])}">${dayLabel(d[0])}: ${esc(d[1])}</option>`).join("") + "</optgroup>";
    }
    html += nirfNispGroups("");
    html += '<optgroup label="Other"><option value="other">Other activity (not in the IIC calendar, NIRF, NISP or R&amp;D list)</option></optgroup>';
    return html;
  }
  // every type, for the tracker's edit dropdown
  function allOptions(selected) {
    let html = `<option value=""${selected ? "" : " selected"}>Not tagged</option>`;
    Object.keys(CAL).forEach(q => {
      html += `<optgroup label="IIC calendar – ${q}">` + CAL[q].items.map((it, i) => opt(calKey(q, i), `${q.replace("Quarter ", "Q")}.${i + 1} ${esc(it[0])}`, selected)).join("") + "</optgroup>";
    });
    html += '<optgroup label="IIC important day celebrations">' + DAYS.map(d => opt(dayKey(d[0]), `${dayLabel(d[0])}: ${esc(d[1])}`, selected)).join("") + "</optgroup>";
    html += nirfNispGroups(selected);
    html += `<optgroup label="Other">${opt("other", "Other activity", selected)}</optgroup>`;
    return html;
  }

  /* ---------- NIRF Innovation / NISP classification of each report ----------
     1) the AI agent's classification (Apps Script, ai_review.classify) when the report has been checked,
     2) otherwise rules on the report title and its activity type (works for every report, old and new),
     plus the NIRF component / NISP item the department chose in "Activity type". */
  const NIRF_RULES = [
    [/startup india|dpiit|start-?up recogni/i, "FSI.SU"],
    [/venture capital|\bvc\b|investor|angel|pitch(ing)? (deck|day|fest|competition)|funding pitch/i, "FSI.VCI"],
    [/seed (fund|grant|money)|sisfs|nidhi|\bbig\b grant|funding agenc|grant proposal|fund ?raising|sponsored/i, "FSI.SF"],
    [/innovation grant|government grant|grant scheme|ivp|innovation voucher/i, "FSI.IG"],
    [/prototype|proof of concept|\bpoc\b|\btrl\b|technology readiness|product (development|design)|innovation (expo|exhibition|showcase)|demo day|deep-?tech/i, "IA.ITRL"],
    [/turnover|revenue model|scale-?up|scaling/i, "IA.NVS"],
    [/alumni (founder|entrepreneur)|alumni connect|alumni talk/i, "IA.AFF"],
    [/research paper|publication|journal|scientific writing|scopus|\bsci\b|manuscript/i, "RIO.PU"],
    [/citation/i, "RIO.CI"],
    [/patent|\bipr\b|intellectual property|copyright|trade ?mark|design registration|kapila/i, "RIO.IPP"],
    [/patent grant/i, "RIO.IPG"],
    [/technology transfer|tech transfer|commerciali[sz]|licens/i, "RIO.PCTT"],
    [/pre-?incubat|ideation|ideathon|idea (pitch|competition|contest|generation)|hackathon|boot ?camp|design thinking|business (model|plan|canvas)|problem (solving|identification)|start-?up|entrepreneur|e-?cell|mentor/i, "PII.PI"],
    [/incubat(ion|or|ee)(?! council)/i, "PII.IE"],
    [/\bfdp\b|faculty development|faculty (training|orientation)/i, "PII.FDP"],
    [/credit course|elective|curriculum|value added course|certificate course/i, "PII.CCI"],
    [/\bnisp\b|i&e policy|innovation (and|&) (start-?up|entrepreneurship) policy|start-?up policy/i, "AIE.NISP"],
    [/kapila/i, "AIE.KAPILA"],
    [/smart india hackathon|\bsih\b/i, "AIE.SIH"],
    [/conclave|summit|symposium|industry (meet|connect|interaction|visit)|alumni meet|exposure visit|field visit|industrial visit|media/i, "PR.PR"]
  ];
  const NISP_RULES = [
    [/\bnisp\b|i&e policy|start-?up policy|innovation policy/i, "N1"],
    [/policy (implementation|implemented)/i, "N3"],
    [/budget|vision|mission|governance|strategy meet/i, "N4"],
    [/pre-?incubat|incubat(ion|or|ee)(?! council)|mentor|start-?up support|prototype|proof of concept/i, "N5"],
    [/patent|\bipr\b|intellectual property|copyright|trade ?mark|technology transfer|licens|commerciali[sz]/i, "N6"],
    [/start-?up|venture|founder|e-?cell|seed fund|investor|(student|faculty) entrepreneur/i, "N7"],
    [/workshop|seminar|session|training|boot ?camp|course|elective|curriculum|\bfdp\b|faculty development|lecture|webinar|talk|awareness|orientation|competition|hackathon|ideathon|design thinking|skill/i, "N8"],
    [/industry|\bmou\b|collaborat|ecosystem|visit|exposure|alumni|partner|roundtable|meetup|conclave|summit/i, "N9"],
    [/impact assessment|survey|feedback analysis|annual report|review meeting|progress tracking/i, "N10"]
  ];
  // the activity type a department chose also says which NIRF / NISP areas a report supports
  const ACT_POLICY = {
    rnd: { R1: [["PII.FDP"], ["N8"]], R2: [["RIO.PU", "PR.PR"], ["N9"]], R3: [["IA.ITRL"], ["N8"]], R4: [["RIO.PCTT"], ["N6"]], R5: [["PII.PI", "AIE.SIH"], ["N8"]],
           R6: [["FSI.SF", "FSI.IG"], ["N8"]], R7: [["RIO.IPP", "AIE.KAPILA"], ["N6"]], R8: [["PII.PI", "RIO.PCTT"], ["N5", "N7"]], R9: [["IA.ITRL", "PII.PI"], ["N5"]],
           R10: [["IA.ITRL"], ["N5"]], R11: [["PR.PR"], ["N9"]], R12: [["PII.PI"], ["N9"]], R13: [["RIO.PU", "RIO.CI"], ["N8"]], R14: [["PR.PR"], ["N10"]],
           R15: [[], ["N4", "N9"]], R16: [[], ["N4", "N9"]], R17: [[], ["N10"]], R18: [["PR.PR"], ["N10"]] }
  };
  const NIRF_CODES = new Set(NIRF.flatMap(p => p[3].map(c => c[0]))), NISP_CODES = new Set(NISP.map(x => x[0]));
  const clsCache = new WeakMap();
  function classify(r) {
    if (!r) return { nirf: [], nisp: [], src: "" };
    if (clsCache.has(r)) return clsCache.get(r);
    const act = actOf(r), p = act.split("|"), nirf = new Set(), nisp = new Set();
    const ai = r.ai_review && r.ai_review.classify;
    let src = "rules";
    if (ai && (Array.isArray(ai.nirf) || Array.isArray(ai.nisp))) {
      (ai.nirf || []).forEach(c => NIRF_CODES.has(c) && nirf.add(c)); (ai.nisp || []).forEach(c => NISP_CODES.has(c) && nisp.add(c)); src = "ai";
    } else {
      const text = [r.title || "", /^(cal|day|rnd)\|/.test(act) ? labelOf(act) : ""].join(" · ");
      NIRF_RULES.forEach(([rx, c]) => rx.test(text) && nirf.add(c));
      NISP_RULES.forEach(([rx, c]) => rx.test(text) && nisp.add(c));
      if (p[0] === "rnd" && ACT_POLICY.rnd[p[1]]) { ACT_POLICY.rnd[p[1]][0].forEach(c => nirf.add(c)); ACT_POLICY.rnd[p[1]][1].forEach(c => nisp.add(c)); }
      if (p[0] === "cal" || p[0] === "day") nirf.add("AIE.IIC");         // IIC calendar activities count towards the IIC's annual performance
    }
    if (p[0] === "nirf" && NIRF_CODES.has(p[1])) nirf.add(p[1]);
    if (p[0] === "nisp" && NISP_CODES.has(p[1])) nisp.add(p[1]);
    const order = [...NIRF_CODES], norder = [...NISP_CODES];
    const out = { nirf: [...nirf].sort((a, b) => order.indexOf(a) - order.indexOf(b)), nisp: [...nisp].sort((a, b) => norder.indexOf(a) - norder.indexOf(b)), src };
    clsCache.set(r, out); return out;
  }
  const nirfName = c => { const f = nirfComp(c); return f ? f.x[1] : c; };
  const nispName = c => { const i = NISP.findIndex(x => x[0] === c); return i >= 0 ? "NISP " + (i + 1) + ": " + NISP[i][1] : c; };
  // the chips shown in the "NIRF / NISP" column
  function policyCell(r) {
    const k = classify(r);
    if (!k.nirf.length && !k.nisp.length) return '<span class="hint">Not classified</span>';
    return `<div class="pol">${k.nirf.map(c => `<span class="pol-chip pol-nirf" title="NIRF Innovation · ${esc(nirfName(c))}">NIRF ${esc(c)}</span>`).join("")}` +
      `${k.nisp.map(c => `<span class="pol-chip pol-nisp" title="${esc(nispName(c))}">NISP ${NISP.findIndex(x => x[0] === c) + 1}</span>`).join("")}` +
      `<span class="pol-src">${k.src === "ai" ? "by AI agent" : "auto (title / activity type)"}</span></div>`;
  }
  const policyText = r => { const k = classify(r); return [k.nirf.map(c => "NIRF " + c + " " + nirfName(c)).join("; "), k.nisp.map(nispName).join("; ")].filter(Boolean).join(" | "); };
  // filter: "", "nirf", "nirf:FSI" (parameter), "nisp", "nisp:N6", "none"
  function policyMatch(r, f) {
    if (!f) return true;
    const k = classify(r), [a, b] = f.split(":");
    if (a === "none") return !k.nirf.length && !k.nisp.length;
    if (a === "nirf") return b ? k.nirf.some(c => c.split(".")[0] === b) : k.nirf.length > 0;
    if (a === "nisp") return b ? k.nisp.includes(b) : k.nisp.length > 0;
    return true;
  }
  const policyFilterOptions = () => '<option value="">NIRF &amp; NISP: all reports</option><option value="nirf">Any NIRF Innovation parameter</option>' +
    NIRF.map(([pc, pn]) => `<option value="nirf:${pc}">NIRF ${pc} · ${esc(pn)}</option>`).join("") +
    '<option value="nisp">Any NISP item</option>' + NISP.map(([c, t], i) => `<option value="nisp:${c}">NISP ${i + 1} · ${esc(t)}</option>`).join("") +
    '<option value="none">Not classified</option>';

  /* ---------------- Dashboard: gap analysis ----------------
     Every area uses the same frame: score → monthly chart → "where to concentrate" → detail table. */
  const actOf = r => r.iic_activity || r.iicActivity || "";
  const monthOf = r => r.month || (r.created_at || r.createdAt || "").slice(0, 7);
  const ayOfMonth = m => { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return mo >= 9 ? y : y - 1; };
  const counted = (r, basis) => (!r.submission || r.submission === "Submitted") && (basis === "verified" ? r.verification === "Verified" : r.verification !== "Rejected");
  const pill = (cls, t) => `<span class="pill p-${cls}">${t}</span>`;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
  let last = null, opts = null, inited = false;
  const openSecs = new Set();

  function quarterNow(Y) {
    const now = new Date(), ay = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    if (ay < Y) return 0; if (ay > Y) return 5;
    return Math.floor(((now.getMonth() - 8 + 12) % 12) / 3) + 1;
  }
  const dateIn = (Y, md) => new Date((+md.slice(0, 2) >= 9 ? Y : Y + 1) + "-" + md + "T00:00:00");
  // the 12 months of IIC year Y (Sep → Aug)
  const monthsOf = Y => Array.from({ length: 12 }, (_, i) => {
    const m = (8 + i) % 12, y = Y + (8 + i >= 12 ? 1 : 0);
    return { i, key: y + "-" + String(m + 1).padStart(2, "0"), short: MON[m], label: MON[m] + " " + y, q: "Quarter " + (Math.floor(i / 3) + 1) };
  });
  const nowKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const when = key => key < nowKey() ? "past" : key === nowKey() ? "current" : "future";
  const monthName = key => { const m = /^(\d{4})-(\d{2})$/.exec(key || ""); return m ? MON[+m[2] - 1] + " " + m[1] : ""; };

  /* ---- building blocks ---- */
  const kpis = list => `<div class="gx-kpis">${list.map(([v, k, cls]) => `<div class="gx-kpi${cls ? " k-" + cls : ""}"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("")}</div>`;
  const legend = items => `<div class="gx-legend">${items.map(([cls, t]) => `<span><i class="sw s-${cls}"></i>${t}</span>`).join("")}</div>`;
  // vertical stacked columns, one per month
  function cols(title, list, max, leg, note) {
    max = Math.max(1, max);
    return `<figure class="gx-fig"><figcaption>${title}</figcaption>
      <div class="gx-cols" role="img" aria-label="${esc(title)}">${list.map(c => {
        const segs = (c.segs || []).filter(s => s.v > 0).map(s => `<span class="seg s-${s.cls}" style="height:${s.v / max * 100}%" title="${esc(s.t)}"></span>`).join("");
        return `<div class="gx-col${c.now ? " now" : ""}${c.future ? " future" : ""}" title="${esc(c.tip || "")}">
          <span class="gx-top${c.flag ? " flag" : ""}">${c.top ?? ""}</span><span class="gx-stack">${segs}</span><span class="gx-lab">${c.lab}</span></div>`;
      }).join("")}</div>${leg ? legend(leg) : ""}${note ? `<p class="hint gx-note">${note}</p>` : ""}</figure>`;
  }
  // horizontal stacked bars
  function hbars(title, rows, leg, note) {
    return `<figure class="gx-fig"><figcaption>${title}</figcaption><div class="gx-hbars">${rows.map(r => `<div class="gx-hrow" title="${esc(r.tip || "")}">
      <span class="gx-hlab">${r.lab}</span><span class="gx-htrack" style="width:${r.width ?? 100}%">${r.segs.filter(s => s.v > 0).map(s => `<span class="seg s-${s.cls}" style="width:${s.v * 100}%" title="${esc(s.t || "")}"></span>`).join("")}</span>
      <span class="gx-hval">${r.val}</span></div>`).join("")}</div>${leg ? legend(leg) : ""}${note ? `<p class="hint gx-note">${note}</p>` : ""}</figure>`;
  }
  function focus(items, empty, more) {
    if (!items.length) return `<div class="gx-focus"><h3>Where to concentrate</h3><p class="gx-clear">${empty}</p></div>`;
    return `<div class="gx-focus"><h3>Where to concentrate</h3><ol>${items.map(x => `<li><span class="pill p-${x.cls}">${x.tag}</span><div><b>${x.text}</b>${x.sub ? `<div class="hint">${x.sub}</div>` : ""}</div></li>`).join("")}</ol>${more ? `<p class="hint">${more}</p>` : ""}</div>`;
  }
  function frame(sec, title, big, intro, body, detailLabel, detail, msg) {
    return `<section class="box gx" id="gx-${sec}">
      <div class="fw-head"><h2>${title}</h2><span class="fw-big">${big}</span></div>
      ${intro ? `<p class="hint" style="margin:0">${intro}</p>` : ""}
      ${body}
      ${msg ? `<span class="msg" id="fwMsg-${sec}" role="status"></span>` : ""}
      <details class="gx-detail" data-sec="${sec}"${openSecs.has(sec) ? " open" : ""}><summary>${detailLabel}</summary>${detail}</details>
    </section>`;
  }
  const take = (list, n) => ({ shown: list.slice(0, n), more: list.length > n ? `+ ${list.length - n} more in the table below.` : "" });

  function render(state, o) {
    const root = document.getElementById("fw"); if (!root || !state) return;
    last = state; opts = o;
    // don't redraw under someone typing a remark; redraw when they leave the box
    if (root.contains(document.activeElement) && document.activeElement.matches("input,select")) {
      if (!root.dataset.wait) { root.dataset.wait = "1"; document.activeElement.addEventListener("blur", () => { delete root.dataset.wait; setTimeout(() => render(last, opts), 0); }, { once: true }); }
      return;
    }
    if (!inited) {
      inited = true; root.addEventListener("change", onChange);
      root.addEventListener("toggle", e => { const d = e.target; if (d.matches && d.matches("details[data-sec]")) d.open ? openSecs.add(d.dataset.sec) : openSecs.delete(d.dataset.sec); }, true);
    }
    const Y = o.year, type = o.type || "", basis = o.basis || "all", yl = Y + "–" + String((Y + 1) % 100).padStart(2, "0");
    const MS = monthsOf(Y), qn = quarterNow(Y), today = new Date(); today.setHours(0, 0, 0, 0);
    const reps = state.reports.filter(r => counted(r, basis) && (!type || r.type === type) && monthOf(r) && ayOfMonth(monthOf(r)) === Y);
    const inKey = (r, key) => { if (actOf(r) === key) return true; const p = key.split("|"), k = (p[0] === "nirf" || p[0] === "nisp") ? classify(r) : null; return !!k && k[p[0]].includes(p[1]); };
    const tally = key => { const l = reps.filter(r => inKey(r, key)); return { n: l.length, depts: [...new Set(l.map(r => r.dept))] }; };
    const scope = type ? " (" + type + " only)" : "";

    /* ===== 1. Monthly submission gap ===== */
    const dk = (t, n) => t + "|" + n;
    const depts = new Map();
    (state.depts || []).filter(d => !type || d.type === type).forEach(d => depts.set(dk(d.type, d.name), { type: d.type, name: d.name }));
    reps.forEach(r => { const k = dk(r.type, r.dept); if (!depts.has(k)) depts.set(k, { type: r.type, name: r.dept }); });
    const T = depts.size;
    const grid = new Map([...depts.keys()].map(k => [k, {}]));        // dept → { monthKey: count }
    reps.forEach(r => { const g = grid.get(dk(r.type, r.dept)), m = monthOf(r); g[m] = (g[m] || 0) + 1; });
    const mStats = MS.map(m => {
      const active = [...grid.values()].filter(g => g[m.key]).length;
      return { ...m, st: when(m.key), active, n: reps.filter(r => monthOf(r) === m.key).length };
    });
    const pastM = mStats.filter(m => m.st === "past"), curM = mStats.find(m => m.st === "current");
    const seen = mStats.filter(m => m.st !== "future");
    const avgCov = seen.length && T ? Math.round(seen.reduce((s, m) => s + m.active / T, 0) / seen.length * 100) : 0;
    const worst = pastM.length ? pastM.reduce((a, b) => (b.active < a.active ? b : a)) : null;
    const deptRows = [...depts.entries()].map(([k, d]) => {
      const g = grid.get(k), missed = pastM.filter(m => !g[m.key]);
      const total = Object.values(g).reduce((a, b) => a + b, 0);
      return { ...d, g, missed, total };
    }).sort((a, b) => b.missed.length - a.missed.length || a.total - b.total || String(a.name).localeCompare(String(b.name)));
    const never = deptRows.filter(d => !d.total).length;

    const monthChart = cols(`Departments that submitted each month${scope} (out of ${T})`, mStats.map(m => {
      const gap = T - m.active;
      return {
        lab: m.short, now: m.st === "current", future: m.st === "future",
        top: m.st === "future" ? "" : m.active + "/" + T, flag: m.st === "past" && T && m.active / T < 0.5,
        tip: `${m.label}: ${m.active} of ${T} departments submitted, ${m.n} report(s)` + (m.st === "current" ? " (month in progress)" : m.st === "future" ? " (upcoming)" : ""),
        segs: m.st === "future" ? [] : [{ v: m.active, cls: "ok", t: m.active + " submitted" }, { v: gap, cls: m.st === "current" ? "warn" : "bad", t: gap + (m.st === "current" ? " yet to submit" : " missed") }]
      };
    }), T, [["ok", "Submitted"], ["bad", "Missed (gap)"], ["warn", "Yet to submit this month"]],
      worst ? `Lowest month so far: <b>${worst.label}</b>, ${worst.active} of ${T} departments (${pct(worst.active, T)}%). Red labels mark months under 50%.` : "");

    const mFocus = [];
    if (curM && T) { const left = T - curM.active; if (left) mFocus.push({ cls: "warn", tag: "This month", text: `${left} of ${T} departments have not submitted for ${curM.label} yet`, sub: "Reminders go out on the 20th. Follow up with the departments marked in the table below." }); }
    deptRows.filter(d => d.missed.length).forEach(d => mFocus.push({
      cls: d.missed.length >= 3 ? "bad" : "warn", tag: d.missed.length + " month" + (d.missed.length > 1 ? "s" : "") + " missed",
      text: esc(d.name) + ` <span class="tag">${esc(d.type)}</span>`, sub: "No report in " + d.missed.map(m => m.short).join(", ") + (d.total ? ` · ${d.total} report(s) this year` : " · nothing submitted this year")
    }));
    const mf = take(mFocus, 8);
    const gridHead = `<tr><th>Department</th>${MS.map(m => `<th class="n${m.key === nowKey() ? " gx-nowcol" : ""}">${m.short}</th>`).join("")}<th class="n">Total</th><th class="n">Missed</th></tr>`;
    const cell = (g, m) => { const n = g[m.key], st = when(m.key); return n ? `<td class="n gx-c ok">${n}</td>` : st === "past" ? '<td class="n gx-c bad" title="Missed">✕</td>' : st === "current" ? '<td class="n gx-c warn" title="Not yet">·</td>' : '<td class="n gx-c"></td>'; };
    const gridRows = deptRows.map(d => `<tr><td style="min-width:180px">${esc(d.name)} <span class="tag">${esc(d.type)}</span></td>${MS.map(m => cell(d.g, m)).join("")}<td class="n"><b>${d.total}</b></td><td class="n">${d.missed.length ? `<b class="gx-badn">${d.missed.length}</b>` : "0"}</td></tr>`).join("");
    const gridFoot = `<tr class="fw-group"><td><b>Departments active</b></td>${mStats.map(m => `<td class="n">${m.st === "future" ? "" : m.active}</td>`).join("")}<td class="n"><b>${reps.length}</b></td><td></td></tr>`;
    const secMonth = frame("month", `Monthly submission gap · ${yl}`, T ? `${avgCov}% average coverage` : "—",
      `Every department is expected to submit at least one report each month (Sep–Aug)${scope}.`,
      kpis([[avgCov + "%", "average monthly coverage", avgCov >= 75 ? "ok" : avgCov >= 50 ? "warn" : "bad"],
        [curM ? curM.active + "/" + T : "—", curM ? "submitted in " + curM.label : "current month", ""],
        [worst ? worst.short : "—", worst ? `lowest month (${pct(worst.active, T)}%)` : "lowest month", worst && worst.active / (T || 1) < 0.5 ? "bad" : ""],
        [never, "departments with no report this year", never ? "bad" : "ok"]]) +
      `<div class="gx-split">${monthChart}${focus(mf.shown, T ? "Every department has submitted in every month so far." : "Add departments in Departments &amp; faculty to see gaps.", mf.more)}</div>`,
      `Department × month grid (${T} departments)`,
      T ? `<div class="scroll"><table class="fw-tbl gx-grid"><thead>${gridHead}</thead><tbody>${gridRows}${gridFoot}</tbody></table></div><p class="hint">✕ missed · · not yet this month · number = reports submitted.</p>` : '<div class="empty">No departments on record yet.</div>');

    /* ===== 2. IIC calendar – mandatory activities ===== */
    const calItems = [];
    Object.keys(CAL).forEach((q, qi) => CAL[q].items.forEach((it, i) => {
      const t = tally(calKey(q, i)), qNo = qi + 1;
      const st = t.n ? "done" : qNo < qn ? "overdue" : qNo === qn ? "due" : "upcoming";
      calItems.push({ q, qNo, i, it, t, st, big: it[1] === L34 });
    }));
    const cnt = (l, s) => l.filter(x => x.st === s).length;
    const doneAll = cnt(calItems, "done"), overdue = cnt(calItems, "overdue"), dueNow = cnt(calItems, "due");
    const calDepts = new Set(reps.filter(r => actOf(r).startsWith("cal|")).map(r => dk(r.type, r.dept))).size;
    const calMonthly = mStats.map(m => {
      const l = reps.filter(r => monthOf(r) === m.key && actOf(r).startsWith("cal|"));
      return { lab: m.short, now: m.st === "current", future: m.st === "future", top: m.st === "future" ? "" : l.length, flag: m.st === "past" && !l.length,
        tip: `${m.label}: ${l.length} report(s) on IIC calendar activities, ${new Set(l.map(actOf)).size} activit${new Set(l.map(actOf)).size === 1 ? "y" : "ies"}`,
        segs: [{ v: l.length, cls: "accent", t: l.length + " report(s)" }] };
    });
    const calMax = Math.max(1, ...calMonthly.map(c => +c.top || 0));
    const qRows = Object.keys(CAL).map(q => {
      const l = calItems.filter(x => x.q === q), d = cnt(l, "done");
      return { lab: q.replace("Quarter ", "Q"), val: d + "/6", tip: `${q}: ${d} of 6 done`,
        segs: [["done", "ok"], ["overdue", "bad"], ["due", "warn"], ["upcoming", "neutral"]].map(([s, cls]) => ({ v: cnt(l, s) / 6, cls, t: cnt(l, s) + " " + s })) };
    });
    const sevC = { overdue: 0, due: 1 };
    const calFocus = calItems.filter(x => x.st === "overdue" || x.st === "due")
      .sort((a, b) => sevC[a.st] - sevC[b.st] || (b.big - a.big) || a.qNo - b.qNo || a.i - b.i)
      .map(x => ({ cls: x.st === "overdue" ? "bad" : "warn", tag: x.st === "overdue" ? "Overdue" : "Due this quarter", text: `${x.qNo}.${x.i + 1} ${esc(x.it[0])}`, sub: `${x.q} · Level ${x.it[1]}${x.big ? " · higher level, counts more in IIC rating" : ""}` }));
    const cf = take(calFocus, 8);
    const calRows = Object.keys(CAL).map(q => {
      const l = calItems.filter(x => x.q === q);
      return `<tr class="fw-group"><td colspan="5"><b>${q}</b> · ${esc(CAL[q].thrust)} <span class="fw-prog">${cnt(l, "done")} of 6 done</span></td></tr>` + l.map(x => {
        const st = { done: pill("ok", "Done"), overdue: pill("bad", "Not done"), due: pill("warn", "Due this quarter"), upcoming: pill("neutral", "Upcoming") }[x.st];
        return `<tr><td class="n">${x.qNo}.${x.i + 1}</td><td>${esc(x.it[0])}<div class="hint">Level ${x.it[1]}</div></td><td class="n"><b>${x.t.n}</b></td>
          <td style="min-width:160px">${x.t.depts.length ? esc(x.t.depts.join(", ")) : '<span class="hint">—</span>'}</td><td>${st}</td></tr>`;
      }).join("");
    }).join("");
    const untagged = reps.filter(r => !actOf(r)).length;
    const secCal = frame("cal", `IIC calendar · mandatory activities · ${yl}`, `${doneAll} of 24 done`,
      `From the IIC 9.0 calendar. An activity is done once a department submits a report tagged with it${scope}.` + (untagged ? ` <b>${untagged} report(s) this year have no IIC activity selected</b>; tag them in All reports so they count.` : ""),
      kpis([[doneAll + "/24", "activities done", doneAll >= 18 ? "ok" : ""], [overdue, "overdue (past quarters)", overdue ? "bad" : "ok"], [dueNow, "due this quarter", dueNow ? "warn" : ""], [calDepts + "/" + T, "departments contributing", ""]]) +
      `<div class="gx-split"><div class="gx-stackfig">${cols("Reports on IIC calendar activities per month", calMonthly, calMax, null, "Red labels mark past months with no calendar activity.")}${hbars("Status by quarter", qRows, [["ok", "Done"], ["bad", "Overdue"], ["warn", "Due this quarter"], ["neutral", "Upcoming"]])}</div>
       ${focus(cf.shown, qn >= 5 ? "All 24 activities were completed this year." : "No overdue or due activities right now.", cf.more)}</div>`,
      "All 24 activities", `<div class="scroll"><table class="fw-tbl"><thead><tr><th class="n">#</th><th>Activity</th><th class="n">Reports</th><th>Departments</th><th>Status</th></tr></thead><tbody>${calRows}</tbody></table></div>`);

    /* ===== 3. Important day celebrations ===== */
    const days = DAYS.map(d => { const t = tally(dayKey(d[0])), w = dateIn(Y, d[0]); return { d, t, w, st: t.n ? "done" : w > today ? "upcoming" : "missed", mk: w.getFullYear() + "-" + d[0].slice(0, 2) }; });
    const dDone = cnt(days, "done"), dMissed = cnt(days, "missed");
    const nextDay = days.filter(x => x.st === "upcoming").sort((a, b) => a.w - b.w)[0];
    const daysLeft = x => Math.round((x.w - today) / 864e5);
    const dayCols = mStats.map(m => {
      const l = days.filter(x => x.mk === m.key);
      return { lab: m.short, now: m.st === "current", future: m.st === "future", top: l.length ? cnt(l, "done") + "/" + l.length : "", flag: cnt(l, "missed") > 0,
        tip: l.length ? `${m.label}: ` + l.map(x => x.d[1] + " – " + (x.st === "done" ? "celebrated" : x.st)).join("; ") : `${m.label}: no listed day`,
        segs: [{ v: cnt(l, "done"), cls: "ok", t: "celebrated" }, { v: cnt(l, "missed"), cls: "bad", t: "missed" }, { v: cnt(l, "upcoming"), cls: "neutral", t: "upcoming" }] };
    });
    const dayFocus = [
      ...days.filter(x => x.st === "missed").map(x => ({ cls: "bad", tag: "Missed", text: esc(x.d[1]), sub: `${dayLabel(x.d[0])} ${x.w.getFullYear()} · no report tagged. If it was celebrated, tag the report in All reports.` })),
      ...days.filter(x => x.st === "upcoming" && daysLeft(x) <= 60).sort((a, b) => a.w - b.w).map(x => ({ cls: "warn", tag: "Plan now", text: esc(x.d[1]), sub: `${dayLabel(x.d[0])} ${x.w.getFullYear()} · in ${daysLeft(x)} day${daysLeft(x) === 1 ? "" : "s"}` }))
    ];
    const df = take(dayFocus, 8);
    const dayRows = days.map(x => `<tr><td style="white-space:nowrap">${dayLabel(x.d[0])} ${x.w.getFullYear()}</td><td>${esc(x.d[1])}</td><td>${x.d[2].replace("Quarter ", "Q")}</td><td class="n"><b>${x.t.n}</b></td>
        <td style="min-width:160px">${x.t.depts.length ? esc(x.t.depts.join(", ")) : '<span class="hint">—</span>'}</td><td>${x.st === "done" ? pill("ok", "Celebrated") : x.st === "upcoming" ? pill("neutral", "Upcoming") : pill("bad", "Not celebrated")}</td></tr>`).join("");
    const secDays = frame("days", `IIC important day celebrations · ${yl}`, `${dDone} of ${DAYS.length} celebrated`, "",
      kpis([[dDone + "/" + DAYS.length, "celebrated", ""], [dMissed, "missed so far", dMissed ? "bad" : "ok"], [nextDay ? dayLabel(nextDay.d[0]) : "—", nextDay ? "next: " + esc(nextDay.d[1]) : "no more this year", ""], [nextDay ? daysLeft(nextDay) : "—", "days to the next one", nextDay && daysLeft(nextDay) <= 15 ? "warn" : ""]]) +
      `<div class="gx-split">${cols("Celebrations due and done each month", dayCols, 2, [["ok", "Celebrated"], ["bad", "Missed"], ["neutral", "Upcoming"]], "Months without a column have no listed day.")}${focus(df.shown, "Nothing missed and nothing due in the next 60 days.", df.more)}</div>`,
      `All ${DAYS.length} days`, `<div class="scroll"><table class="fw-tbl"><thead><tr><th>Date</th><th>Celebration</th><th>Quarter</th><th class="n">Reports</th><th>Departments</th><th>Status</th></tr></thead><tbody>${dayRows}</tbody></table></div>`);

    /* ===== 3b. Prescribed R&D activities ===== */
    const themes = [...new Set(RND.map(r => r[1]))];
    const elapsed = mStats.filter(m => m.st !== "future").length;          // months of the IIC year so far
    const pace = Math.min(RND.length, Math.round(RND.length * elapsed / 12));
    const rItems = RND.map(([c, th, t, d, lv], i) => {
      const l = reps.filter(r => actOf(r) === rndKey(c));
      const lastM = l.map(monthOf).sort().pop() || "";
      return { c, th, t, d, lv, i, n: l.length, depts: [...new Set(l.map(r => r.dept))], lastM, done: l.length > 0 };
    });
    const rDone = rItems.filter(x => x.done).length;
    const thStats = themes.map(th => { const l = rItems.filter(x => x.th === th); return { th, l, d: l.filter(x => x.done).length }; });
    const thCovered = thStats.filter(x => x.d > 0).length;
    const rReps = reps.filter(r => actOf(r).startsWith("rnd|"));
    const rDepts = new Set(rReps.map(r => dk(r.type, r.dept))).size;
    const rMonthly = mStats.map(m => {
      const l = rReps.filter(r => monthOf(r) === m.key);
      return { lab: m.short, now: m.st === "current", future: m.st === "future", top: m.st === "future" ? "" : l.length, flag: m.st === "past" && !l.length,
        tip: `${m.label}: ${l.length} report(s) on prescribed R&D activities`, segs: [{ v: l.length, cls: "accent", t: l.length + " report(s)" }] };
    });
    const thRows = thStats.map(x => ({ lab: esc(x.th), val: x.d + "/" + x.l.length, tip: `${x.th}: ${x.d} of ${x.l.length} done`,
      segs: [{ v: x.d / x.l.length, cls: "ok", t: x.d + " done" }, { v: (x.l.length - x.d) / x.l.length, cls: "bad", t: (x.l.length - x.d) + " not done" }] }));
    const rFocus = [
      ...thStats.filter(x => !x.d).map(x => ({ cls: "bad", tag: "Sub-theme not started", text: esc(x.th), sub: x.l.map(y => "R&amp;D " + (y.i + 1) + " " + esc(y.t)).join(" · ") })),
      ...rItems.filter(x => !x.done && thStats.find(y => y.th === x.th).d > 0).map(x => ({ cls: "warn", tag: "Not done", text: `R&amp;D ${x.i + 1}. ${esc(x.t)}`, sub: `${esc(x.th)} · ${esc(x.lv)}` }))
    ];
    const rfx = take(rFocus, 8);
    const rRows = thStats.map(x => `<tr class="fw-group"><td colspan="6"><b>${esc(x.th)}</b> <span class="fw-prog">${x.d} of ${x.l.length} done</span></td></tr>` +
      x.l.map(y => `<tr><td class="n">${y.i + 1}</td><td>${esc(y.t)}<div class="hint">${esc(y.d)}</div></td><td>${esc(y.lv)}</td><td class="n"><b>${y.n}</b></td>
        <td style="min-width:160px">${y.depts.length ? esc(y.depts.join(", ")) : '<span class="hint">—</span>'}${y.lastM ? `<div class="hint">last: ${monthName(y.lastM)}</div>` : ""}</td><td>${y.done ? pill("ok", "Done") : pill("bad", "Not done")}</td></tr>`).join("")).join("");
    const secRnd = frame("rnd", `Prescribed R&amp;D activities · ${yl}`, `${rDone} of ${RND.length} done`,
      `The 18 prescribed R&amp;D activities in 8 sub-themes. An activity is done once a department submits a report with it chosen as the Activity type${scope}. To spread them over the year, about <b>${pace}</b> should be done by now.`,
      kpis([[rDone + "/" + RND.length, "activities done", rDone >= pace ? "ok" : rDone >= pace / 2 ? "warn" : "bad"], [thCovered + "/" + themes.length, "sub-themes covered", thCovered === themes.length ? "ok" : "warn"],
            [Math.max(0, pace - rDone), "behind the pace for this point of the year", pace - rDone > 0 ? "bad" : "ok"], [rDepts + "/" + T, "departments contributing", ""]]) +
      `<div class="gx-split"><div class="gx-stackfig">${cols("Reports on R&amp;D activities per month", rMonthly, Math.max(1, ...rMonthly.map(c => +c.top || 0)), null, `${rReps.length} report(s) this year. Red labels mark past months with none.`)}
        ${hbars("Done by sub-theme", thRows, [["ok", "Done"], ["bad", "Not done"]])}</div>
        ${focus(rfx.shown, "All 18 R&amp;D activities have been done this year.", rfx.more)}</div>`,
      "All 18 R&amp;D activities", `<div class="scroll"><table class="fw-tbl"><thead><tr><th class="n">#</th><th>Activity</th><th>Level / duration</th><th class="n">Reports</th><th>Departments</th><th>Status</th></tr></thead><tbody>${rRows}</tbody></table></div>`);

    /* ===== shared editing for NISP and NIRF (stored per IIC year) ===== */
    const comp = state.compliance || {};
    const get = code => comp[Y + ":" + code] || {};
    const canEdit = !!o.save;
    const sCls = s => s === "Achieved" ? "ok" : s === "In progress" ? "warn" : s === "Not applicable" ? "neutral" : "bad";
    const sel = (sec, code, cur) => canEdit
      ? `<select class="vsel v-${sCls(cur)}" data-sec="${sec}" data-fw="${code}" data-field="status" aria-label="Status">${STATUSES.map(s => `<option${s === (cur || "Not started") ? " selected" : ""}>${s}</option>`).join("")}</select>`
      : pill(sCls(cur), esc(cur || "Not started"));
    const inp = (sec, code, field, v, ph) => canEdit
      ? `<input class="fw-in" data-sec="${sec}" data-fw="${code}" data-field="${field}" maxlength="300" value="${esc(v || "")}" placeholder="${ph}" aria-label="${ph}">`
      : esc(v || "—");
    const tsel = (sec, code, v) => canEdit
      ? `<select class="fw-in gx-tsel" data-sec="${sec}" data-fw="${code}" data-field="target" aria-label="Target month"><option value="">No target</option>${MS.map(m => `<option value="${m.key}"${m.key === v ? " selected" : ""}>${m.label}</option>`).join("")}</select>`
      : esc(monthName(v) || "—");
    const upd = c => { const x = get(c); return x.updated_at || x.updatedAt ? new Date(x.updated_at || x.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""; };
    // where an item stands against its target month
    const tState = x => { const s = x.status || "Not started"; if (s === "Achieved" || s === "Not applicable") return s; if (!x.target) return "notarget"; return when(x.target) === "past" ? "overdue" : s; };
    const targetCols = (items) => mStats.map(m => {
      const l = items.filter(x => x.target === m.key);
      const a = l.filter(x => x.status === "Achieved").length, p = l.filter(x => x.status === "In progress").length, na = l.filter(x => x.status === "Not applicable").length;
      const ns = l.length - a - p - na, late = m.st === "past";
      return { lab: m.short, now: m.st === "current", future: m.st === "future", top: l.length ? a + "/" + (l.length - na) : "", flag: late && (ns + p) > 0,
        tip: l.length ? `${m.label}: ${l.length} item(s) targeted – ${a} achieved, ${p} in progress, ${ns} not started` : `${m.label}: nothing targeted`,
        segs: [{ v: a, cls: "ok", t: "achieved" }, { v: p, cls: late ? "bad" : "warn", t: "in progress" }, { v: ns, cls: late ? "bad" : "neutral", t: "not started" }] };
    });
    const tLegend = [["ok", "Achieved"], ["warn", "In progress"], ["neutral", "Not started"], ["bad", "Past target, not achieved"]];
    // reports tagged with an item move it to "In progress" automatically until the coordinator sets a status
    const effective = (x, t) => { const s = x.status || "Not started"; return s === "Not started" && t.n ? { status: "In progress", auto: true } : { status: s, auto: false }; };
    const repCell = t => `<b>${t.n}</b>${t.depts.length ? `<div class="hint">${esc(t.depts.join(", "))}</div>` : ""}`;
    const autoNote = e => e.auto ? '<div class="hint gx-auto">Reports received → counted as In progress</div>' : "";
    const repMonthly = (prefix, what) => { const pk = prefix.replace("|", ""); const l0 = reps.filter(r => actOf(r).startsWith(prefix) || ((pk === "nirf" || pk === "nisp") && classify(r)[pk].length)); return cols(`Reports classified under ${what} per month`, mStats.map(m => {
      const l = l0.filter(r => monthOf(r) === m.key);
      return { lab: m.short, now: m.st === "current", future: m.st === "future", top: m.st === "future" ? "" : l.length, flag: m.st === "past" && !l.length,
        tip: `${m.label}: ${l.length} report(s) on ${what}`, segs: [{ v: l.length, cls: "accent", t: l.length + " report(s)" }] };
    }), Math.max(1, ...mStats.map(m => l0.filter(r => monthOf(r) === m.key).length)), null, `${l0.length} report(s) this year. Red labels mark past months with none.`); };

    /* ===== 4. NISP ===== */
    const nisp = NISP.map(([c, t], i) => { const x = get(c), rp = tally(nispKey(c)), e = effective(x, rp); return { c, t, i, rp, e, status: e.status, target: x.target || "", ts: tState({ ...x, status: e.status }) }; });
    const nA = nisp.filter(x => x.status === "Achieved").length, nP = nisp.filter(x => x.status === "In progress").length;
    const nNA = nisp.filter(x => x.status === "Not applicable").length, nN = NISP.length - nA - nP - nNA;
    const nOver = nisp.filter(x => x.ts === "overdue").length, nNoT = nisp.filter(x => x.ts === "notarget").length;
    const nispFocus = [
      ...nisp.filter(x => x.ts === "overdue").map(x => ({ cls: "bad", tag: "Past target", text: `${x.i + 1}. ${esc(x.t)}`, sub: `Target ${monthName(x.target)} · ${x.status} · ${x.rp.n} report(s)` })),
      ...nisp.filter(x => x.ts === "notarget" && x.status === "Not started").map(x => ({ cls: "bad", tag: "Not started", text: `${x.i + 1}. ${esc(x.t)}`, sub: "No reports yet and no target month set." })),
      ...nisp.filter(x => x.ts === "notarget" && x.status === "In progress").map(x => ({ cls: "warn", tag: "In progress", text: `${x.i + 1}. ${esc(x.t)}`, sub: `${x.rp.n} report(s) · no target month set` })),
      ...nisp.filter(x => x.ts === "In progress" || (x.ts === "Not started")).sort((a, b) => a.target.localeCompare(b.target)).map(x => ({ cls: x.status === "In progress" ? "warn" : "neutral", tag: "Due " + monthName(x.target), text: `${x.i + 1}. ${esc(x.t)}`, sub: `${x.status} · ${x.rp.n} report(s)` }))
    ];
    const nf = take(nispFocus, 8);
    const nispRows = nisp.map(x => `<tr><td class="n">${x.i + 1}</td><td>${esc(x.t)}</td><td class="n">${repCell(x.rp)}</td><td>${sel("nisp", x.c, get(x.c).status)}${autoNote(x.e)}</td><td>${tsel("nisp", x.c, x.target)}</td><td>${inp("nisp", x.c, "remarks", get(x.c).remarks, "Remarks / evidence")}</td><td class="hint">${upd(x.c)}</td></tr>`).join("");
    const nispPct = pct(nA + nP * 0.5, NISP.length - nNA);
    const secNisp = frame("nisp", `NISP status · ${yl}`, `${nA} of ${NISP.length - nNA} achieved`,
      `National Innovation and Start-up Policy. Every report classified under a NISP item (by the AI agent, from its title or from the activity type chosen) counts here automatically${scope}. ${canEdit ? "Confirm each item's status and set a target month in the table; it saves as you go." : ""}`,
      kpis([[nispPct + "%", "readiness (in progress counts half)", nispPct >= 75 ? "ok" : nispPct >= 40 ? "warn" : "bad"], [nA, "achieved", "ok"], [nP + nN, "still open", nP + nN ? "warn" : "ok"], [nOver, "past their target month", nOver ? "bad" : "ok"]]) +
      `<div class="gx-split"><div class="gx-stackfig">${hbars("Overall", [{ lab: "NISP", val: nA + "/" + (NISP.length - nNA), segs: [{ v: nA / NISP.length, cls: "ok" }, { v: nP / NISP.length, cls: "warn" }, { v: nN / NISP.length, cls: "bad" }, { v: nNA / NISP.length, cls: "neutral" }] }], [["ok", "Achieved"], ["warn", "In progress"], ["bad", "Not started"], ["neutral", "Not applicable"]])}
        ${repMonthly("nisp|", "NISP items")}
        ${cols("Items by target month", targetCols(nisp), Math.max(2, ...mStats.map(m => nisp.filter(x => x.target === m.key).length)), tLegend, nNoT ? `<b>${nNoT}</b> open item(s) have no target month yet.` : "")}</div>
        ${focus(nf.shown, "All NISP items are achieved.", nf.more)}</div>`,
      "All NISP items · status, target and evidence",
      `<div class="scroll"><table class="fw-tbl"><thead><tr><th class="n">#</th><th>Item</th><th class="n">Reports</th><th>Status</th><th>Target month</th><th>Remarks / evidence</th><th>Updated</th></tr></thead><tbody>${nispRows}</tbody></table></div>`, true);

    /* ===== 5. NIRF Innovation 2025 ===== */
    const comps = NIRF.flatMap(([pc, pn, w, list]) => list.map(([c, t, marks, what]) => {
      const x = get(c), rp = tally(nirfKey(c)), e = effective(x, rp), status = e.status, f = status === "Not applicable" ? 0 : (FACTOR[status] || 0);
      const max = status === "Not applicable" ? 0 : marks * w;
      return { pc, pn, w, c, t, marks, what, rp, e, status, target: x.target || "", ts: tState({ ...x, status }), max, got: max * f, gap: max * (1 - f) };
    }));
    const possible = comps.reduce((s, x) => s + x.max, 0), secured = comps.reduce((s, x) => s + x.got, 0);
    const score = possible ? secured / possible * 100 : 0;
    const params = NIRF.map(([pc, pn, w]) => {
      const l = comps.filter(x => x.pc === pc), max = l.reduce((s, x) => s + x.max, 0);
      const ach = l.filter(x => x.status === "Achieved").reduce((s, x) => s + x.max, 0), prog = l.filter(x => x.status === "In progress").reduce((s, x) => s + x.max, 0);
      return { pc, pn, w, max, got: l.reduce((s, x) => s + x.got, 0), ach, prog, gap: l.reduce((s, x) => s + x.gap, 0) };
    });
    const bigGap = params.slice().sort((a, b) => b.gap - a.gap)[0];
    const cAch = comps.filter(x => x.status === "Achieved").length, cNA = comps.filter(x => x.status === "Not applicable").length;
    const cOver = comps.filter(x => x.ts === "overdue").length;
    const pRows = params.slice().sort((a, b) => b.gap - a.gap).map(p => ({
      lab: `<b>${p.pc}</b> ${esc(p.pn)}`, width: p.w / 0.30 * 100, val: `${fmt1(p.got)} / ${fmt1(p.max)}`,
      tip: `${p.pn}: weight ${p.w.toFixed(2)} → ${fmt1(p.max)} of 100 points. Secured ${fmt1(p.got)}, open ${fmt1(p.gap)}.`,
      segs: p.max ? [{ v: p.ach / p.max, cls: "ok", t: "achieved" }, { v: p.prog / p.max * 0.5, cls: "warn", t: "in progress (half)" }, { v: p.gap / p.max, cls: "bad", t: "gap" }] : []
    }));
    const iicNote = `IIC calendar this year: ${doneAll}/24 activities and ${dDone}/${DAYS.length} celebrations done.`;
    const link = { "AIE.IIC": iicNote, "AIE.NISP": `NISP item 1 (registration): ${nisp[0] ? nisp[0].status : "—"}.` };
    const nirfFocus = comps.filter(x => x.gap > 0).sort((a, b) => (b.ts === "overdue") - (a.ts === "overdue") || b.gap - a.gap).map(x => ({
      cls: x.ts === "overdue" ? "bad" : x.status === "In progress" ? "warn" : x.gap >= 3 ? "bad" : "neutral",
      tag: (x.ts === "overdue" ? "Past target · " : "") + fmt1(x.gap) + " pts open",
      text: `${x.pc} · ${esc(x.t)}`, sub: `${x.status} · ${x.rp.n} report(s)${x.target ? " · target " + monthName(x.target) : ""} · ${esc(x.what)}${link[x.c] ? " · " + link[x.c] : ""}`
    }));
    const rf = take(nirfFocus, 8);
    const nirfRows = NIRF.map(([pc, pn, w, list]) => {
      const p = params.find(x => x.pc === pc);
      return `<tr class="fw-group"><td colspan="8"><b>${pc} · ${esc(pn)}</b> · weight ${w.toFixed(2)} (${fmt1(w * 100)} of 100 points) <span class="fw-prog">${p.max ? pct(p.got, p.max) : 0}% ready · ${fmt1(p.gap)} pts open</span></td></tr>` +
        list.map(([c, t, marks, what]) => { const x = get(c), cp = comps.find(y => y.c === c); return `<tr><td class="n" style="white-space:nowrap">${c.split(".")[1]}</td><td>${esc(t)}<div class="hint">${marks} marks · ${fmt1(marks * w)} pts overall · ${esc(what)}${link[c] ? "<br>" + link[c] : ""}</div></td>
          <td class="n">${repCell(cp.rp)}</td><td>${sel("nirf", c, x.status)}${autoNote(cp.e)}</td><td>${inp("nirf", c, "value", x.value, "Count / value (3 yrs)")}</td><td>${tsel("nirf", c, x.target || "")}</td><td>${inp("nirf", c, "remarks", x.remarks, "Remarks / evidence")}</td><td class="hint">${upd(c)}</td></tr>`; }).join("");
    }).join("");
    const secNirf = frame("nirf", `NIRF Innovation 2025 · ${yl}`, `${Math.round(score)}% ready`,
      `6 parameters from the NIRF India Rankings 2025 Innovation methodology (FSI 0.25 · IA 0.15 · RIO 0.30 · PII 0.10 · AIE 0.10 · PR 0.10). Every report classified under a NIRF component (by the AI agent, from its title or from the activity type chosen) counts here automatically${scope}. Readiness counts Achieved as full and In progress as half, weighted by marks and parameter weight. It shows how complete your evidence is, not the NIRF score.`,
      kpis([[Math.round(score) + "%", `readiness (${fmt1(secured)} of ${fmt1(possible)} weighted points)`, score >= 70 ? "ok" : score >= 40 ? "warn" : "bad"],
        [bigGap ? bigGap.pc : "—", bigGap ? `largest gap: ${esc(bigGap.pn)} (${fmt1(bigGap.gap)} pts)` : "largest gap", bigGap && bigGap.gap ? "bad" : ""],
        [cAch + "/" + (comps.length - cNA), "components achieved", ""], [cOver, "past their target month", cOver ? "bad" : "ok"]]) +
      `<div class="gx-split"><div class="gx-stackfig">${hbars("Weighted points by parameter, biggest gap first (bar length = parameter weight)", pRows, [["ok", "Achieved"], ["warn", "In progress (half)"], ["bad", "Gap"]])}
        ${repMonthly("nirf|", "NIRF components")}
        ${cols("Components by target month", targetCols(comps), Math.max(2, ...mStats.map(m => comps.filter(x => x.target === m.key).length)), tLegend, comps.filter(x => x.ts === "notarget").length ? `<b>${comps.filter(x => x.ts === "notarget").length}</b> open component(s) have no target month yet.` : "")}</div>
        ${focus(rf.shown, "Every component is achieved or not applicable.", rf.more || "Ranked by weighted points still open; past-target items first.")}</div>`,
      `All ${comps.length} components · status, count, target and evidence`,
      `<div class="scroll"><table class="fw-tbl"><thead><tr><th class="n">#</th><th>Component</th><th class="n">Reports</th><th>Status</th><th>Count / value</th><th>Target month</th><th>Remarks / evidence</th><th>Updated</th></tr></thead><tbody>${nirfRows}</tbody></table></div>`, true);

    root.innerHTML = secMonth + secCal + secDays + secRnd + secNisp + secNirf;
  }

  async function onChange(e) {
    const el = e.target.closest("[data-fw]"); if (!el || !opts || !opts.save) return;
    const code = el.dataset.fw, field = el.dataset.field, Y = opts.year, id = Y + ":" + code;
    const msgId = "fwMsg-" + (el.dataset.sec || "nirf"), msg = document.getElementById(msgId);
    const say = (cls, t) => setTimeout(() => { const m = document.getElementById(msgId); if (m) { m.className = "msg" + (cls ? " " + cls : ""); m.textContent = t; } }, 0);
    const cur = (last.compliance || {})[id] || {};
    const value = field === "status" ? el.value : el.value.trim();
    if ((cur[field] || (field === "status" ? "Not started" : "")) === value) return;
    if (msg) { msg.className = "msg"; msg.textContent = "Saving…"; }
    try {
      await opts.save(id, { year: Y, code, status: cur.status || "Not started", value: cur.value || "", remarks: cur.remarks || "", target: cur.target || "", [field]: value });
      say("ok", "Saved.");
    } catch (err) { say("err", (err && err.message) || "Couldn't save. Try again."); }
  }

  // rows for Excel / PDF
  function exportSheets(state, Y) {
    const comp = state.compliance || {}, get = c => comp[Y + ":" + c] || {};
    return {
      nisp: NISP.map(([c, t], i) => [i + 1, t, get(c).status || "Not started", monthName(get(c).target), get(c).remarks || ""]),
      nirf: NIRF.flatMap(([pc, pn, w, list]) => list.map(([c, t, marks]) => { const x = get(c); return [pc + " " + pn + " (" + w.toFixed(2) + ")", c, t, marks, x.status || "Not started", x.value || "", monthName(x.target), x.remarks || ""]; }))
    };
  }

  window.IICFramework = { CAL, DAYS, NIRF, NISP, RND, classify, policyCell, policyText, policyMatch, policyFilterOptions, optionsFor, allOptions, labelOf, render, exportSheets };
})();
