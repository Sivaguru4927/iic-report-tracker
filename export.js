// Excel (.xlsx) and PDF exports for the tracker. Libraries load only when first used.
(function () {
  const LIBS = {
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"
  };
  const loaded = {};
  function load(key) {
    if (!loaded[key]) loaded[key] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = LIBS[key]; s.onload = res;
      s.onerror = () => { delete loaded[key]; rej(new Error("Couldn't load the export tool. Check your internet connection and try again.")); };
      document.head.appendChild(s);
    });
    return loaded[key];
  }

  const COLLEGE = "PSG College of Arts & Science, Coimbatore – 641 014";
  const UNIT = "Centre for Innovation, Incubation & Entrepreneurship (CII&E) · IIC";
  const today = () => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  /**
   * sheets: [{ name, title, subtitle, head: [...], rows: [[...]], widths: [chars...] }]
   * Returns a Blob (.xlsx)
   */
  async function toExcel(sheets) {
    await load("xlsx");
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const aoa = [[COLLEGE], [UNIT], [sh.title], [(sh.subtitle ? sh.subtitle + " · " : "") + "Generated on " + today()], [], sh.head, ...sh.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const last = sh.head.length - 1;
      ws["!merges"] = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: last } }));
      if (sh.widths) ws["!cols"] = sh.widths.map(w => ({ wch: w }));
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + sh.rows.length, c: last } }) };
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  /**
   * opts: { title, subtitle, head, rows, orientation: "landscape"|"portrait",
   *         rowKinds: ["", "sub", "grand", ...] (optional, one per row),
   *         columnStyles: { index: { cellWidth, halign } } (optional),
   *         intro: "text line shown above the table" (optional) }
   * Returns a Blob (.pdf)
   */
  async function toPdf(opts) {
    await load("jspdf");
    await load("autotable");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: opts.orientation || "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), M = 36;
    let y = 40;
    doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(31, 63, 191);
    doc.text(COLLEGE, W / 2, y, { align: "center" }); y += 17;
    doc.setFontSize(11); doc.setTextColor(192, 18, 155);
    doc.text(UNIT, W / 2, y, { align: "center" }); y += 18;
    doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text(opts.title, W / 2, y, { align: "center" }); y += 14;
    doc.setFont("times", "normal"); doc.setFontSize(9); doc.setTextColor(90, 107, 101);
    doc.text((opts.subtitle ? opts.subtitle + "  ·  " : "") + "Generated on " + today(), W / 2, y, { align: "center" }); y += 10;
    if (opts.intro) { y += 8; doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.text(opts.intro, M, y); y += 4; }

    const kinds = opts.rowKinds || [];
    doc.autoTable({
      head: [opts.head],
      body: opts.rows.map(r => r.map(v => v == null ? "" : String(v))),
      startY: y + 8,
      margin: { left: M, right: M, bottom: 36 },
      theme: "grid",
      styles: { font: "helvetica", fontSize: opts.fontSize || 8, cellPadding: 3, lineColor: [180, 190, 186], lineWidth: 0.5, textColor: [23, 35, 31], overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [20, 92, 76], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [245, 247, 246] },
      columnStyles: opts.columnStyles || {},
      didParseCell: d => {
        if (d.section !== "body") return;
        const k = kinds[d.row.index];
        if (k === "sub") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [220, 239, 233]; }
        if (k === "grand") { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [23, 35, 31]; d.cell.styles.textColor = 255; }
      },
      didDrawPage: () => {
        const H = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
        doc.text("Page " + doc.internal.getNumberOfPages(), W - M, H - 18, { align: "right" });
        doc.text("IIC REPORT TRACKER · CII&E, PSGCAS", M, H - 18);
      }
    });
    return doc.output("blob");
  }

  window.IICExport = { toExcel, toPdf };
})();
