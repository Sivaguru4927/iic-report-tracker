// Type-to-search department picker.
// makeDeptCombo({ input, list, getItems, getType, getSelected, onPick })
//   getItems()  -> [{ type, name, faculty: [names] }]
//   getType()   -> "Aided" | "SF" | ""  (departments of this type are listed first)
//   getSelected() -> { type, name } | null   (current choice, to restore text on blur)
//   onPick(item) -> called with { type, name } when a department is chosen
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mark = (text, words) => {
    let out = esc(text);
    words.filter(Boolean).sort((a, b) => b.length - a.length).forEach(w => {
      const re = new RegExp("(" + esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  };

  window.makeDeptCombo = function (o) {
    const { input, list } = o;
    let shown = [], active = -1;

    function search() {
      const q = input.value.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const t = o.getType();
      const items = o.getItems();
      const res = [];
      for (const d of items) {
        const name = d.name.toLowerCase();
        const byName = words.every(w => name.includes(w));
        const fac = !byName && words.length ? (d.faculty || []).find(f => words.every(w => f.toLowerCase().includes(w))) : null;
        if (!words.length || byName || fac) res.push({ ...d, via: fac || "", score: (!words.length ? 2 : name.startsWith(q) ? 0 : byName ? 1 : 3) * 2 + (t && d.type !== t ? 1 : 0) });
      }
      res.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.type.localeCompare(b.type));
      shown = res.slice(0, 40);
      active = shown.length ? 0 : -1;
      if (!items.length) {
        list.innerHTML = '<li class="combo-empty">No departments have been added yet.</li>';
      } else if (!shown.length) {
        list.innerHTML = `<li class="combo-empty">No department matches “${esc(input.value.trim())}”.</li>`;
      } else {
        list.innerHTML = shown.map((d, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="${i === active}" class="${i === active ? "on" : ""}">
          <span class="combo-name">${mark(d.name, words)}</span><span class="tag">${esc(d.type)}</span>
          ${d.via ? `<span class="combo-via">Faculty: ${mark(d.via, words)}</span>` : ""}</li>`).join("") +
          (res.length > shown.length ? `<li class="combo-empty">${res.length - shown.length} more. Type more letters to narrow down.</li>` : "");
      }
      open(true);
    }
    function open(v) {
      list.hidden = !v;
      input.setAttribute("aria-expanded", v ? "true" : "false");
      if (v && active >= 0) input.setAttribute("aria-activedescendant", list.id + "-" + active);
      else input.removeAttribute("aria-activedescendant");
    }
    function setActive(i) {
      if (!shown.length) return;
      active = (i + shown.length) % shown.length;
      list.querySelectorAll("li[role=option]").forEach(li => {
        const on = +li.dataset.i === active;
        li.classList.toggle("on", on); li.setAttribute("aria-selected", on);
        if (on) li.scrollIntoView({ block: "nearest" });
      });
      input.setAttribute("aria-activedescendant", list.id + "-" + active);
    }
    function pick(i) {
      const d = shown[i]; if (!d) return;
      input.value = d.name;
      open(false);
      o.onPick({ type: d.type, name: d.name });
    }
    function restore() {
      const sel = o.getSelected();
      const typed = input.value.trim().toLowerCase();
      if (sel && typed === sel.name.toLowerCase()) { input.value = sel.name; return; }
      // exact name typed → choose it if unambiguous
      const t = o.getType();
      let exact = o.getItems().filter(d => d.name.toLowerCase() === typed);
      if (exact.length > 1 && t) exact = exact.filter(d => d.type === t);
      if (typed && exact.length === 1) { input.value = exact[0].name; o.onPick({ type: exact[0].type, name: exact[0].name }); return; }
      input.value = sel ? sel.name : "";
    }

    input.addEventListener("input", search);
    input.addEventListener("focus", () => { input.select(); search(); });
    input.addEventListener("click", () => { if (list.hidden) { input.select(); search(); } });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) search(); else setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") { if (!list.hidden && active >= 0) { e.preventDefault(); pick(active); } }
      else if (e.key === "Escape") { open(false); restore(); }
    });
    input.addEventListener("blur", () => setTimeout(() => { open(false); restore(); }, 120));
    list.addEventListener("mousedown", e => { const li = e.target.closest("li[role=option]"); if (li) { e.preventDefault(); pick(+li.dataset.i); } });

    return {
      clear() { input.value = ""; open(false); },
      show(name) { input.value = name || ""; }
    };
  };
})();
