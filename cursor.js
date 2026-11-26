/* Animated mouse pointer: a small white open book whose page keeps turning.
   Browsers don't animate a CSS cursor image, so the system pointer is hidden and this book follows the mouse.
   It is skipped on touch screens and for people who ask their computer for reduced motion (they keep the
   still book cursor from styles.css). Text boxes keep the normal typing cursor. */
(function () {
  if (!window.matchMedia || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const css = `
html.book-cursor, html.book-cursor * { cursor: none !important; }
html.book-cursor input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),
html.book-cursor textarea, html.book-cursor [contenteditable="true"] { cursor: text !important; }
#bookCursor { position: fixed; left: 0; top: 0; width: 17px; height: 17px; margin: -4px 0 0 -8.5px; pointer-events: none; z-index: 2147483647;
  opacity: 0; transition: opacity .15s; will-change: transform; }
#bookCursor.on { opacity: 1; }
#bookCursor .bc-in { width: 100%; height: 100%; transition: transform .15s ease-out; }
#bookCursor.hot .bc-in { transform: scale(1.25); }
#bookCursor.down .bc-in { transform: scale(.85); }
#bookCursor svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
#bookCursor .bc-page { transform-origin: 16px 0; transform-box: view-box; animation: bc-turn 1.8s ease-in-out infinite; }
#bookCursor.hot .bc-page { animation-duration: .8s; }
@keyframes bc-turn { 0%, 20% { transform: scaleX(1); } 50% { transform: scaleX(0); } 80%, 100% { transform: scaleX(-1); } }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "bookCursor"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="bc-in"><svg viewBox="0 0 32 32">
    <path d="M16 8C12 5 7 5 3 6V25C7 24 12 24 16 27C20 24 25 24 29 25V6C25 5 20 5 16 8Z" fill="#fff" stroke="#26332f" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M7 12h5M7 16h5M20 12h5M20 16h5" stroke="#9aa7a2" stroke-width="1.6" stroke-linecap="round"/>
    <path class="bc-page" d="M16 8.5C19.5 6 23.5 6 26.5 6.8V23.8C23.5 23 19.5 23.3 16 25.5Z" fill="#fff" stroke="#26332f" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 8V27" stroke="#26332f" stroke-width="2"/></svg></div>`;
  const add = () => { document.body.appendChild(el); document.documentElement.classList.add("book-cursor"); };
  if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);

  const CLICK = 'a, button, select, summary, label, [role="tab"], [role="option"], .btn, .linkbtn, .read-dot, input[type="file"], input[type="checkbox"], [data-tip], .bcol, .catrow';
  const TEXT = 'input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
  let x = -100, y = -100, raf = 0;
  const draw = () => { raf = 0; el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  document.addEventListener("mousemove", e => {
    x = e.clientX; y = e.clientY;
    const t = e.target instanceof Element ? e.target : null;
    const typing = !!(t && t.closest(TEXT));
    el.classList.toggle("on", !typing);                       // over a text box the normal typing cursor shows instead
    el.classList.toggle("hot", !!(t && !typing && t.closest(CLICK)));
    if (!raf) raf = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener("mousedown", () => el.classList.add("down"));
  document.addEventListener("mouseup", () => el.classList.remove("down"));
  document.documentElement.addEventListener("mouseleave", () => el.classList.remove("on"));
  window.addEventListener("blur", () => el.classList.remove("on"));
})();
