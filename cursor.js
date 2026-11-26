/* Animated mouse pointer for the IIC portal: "the idea pointer".
   A rainbow arrow whose colours keep flowing, carrying a small light bulb, the sign of a new idea:
   · the bulb glows softly while you move around the page,
   · over anything you can click it lights up gold and sends out rays,
   · a click gives a small spark at the arrow's tip.
   The arrow's tip is the click point, exactly like the normal arrow. Browsers don't animate a CSS cursor image,
   so the system pointer is hidden and this one follows the mouse. Skipped on touch screens and when the computer
   asks for reduced motion (they keep the still pointer from styles.css). Text boxes keep the normal typing cursor. */
(function () {
  if (!window.matchMedia || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const css = `
html.idea-cursor, html.idea-cursor * { cursor: none !important; }
html.idea-cursor input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),
html.idea-cursor textarea, html.idea-cursor [contenteditable="true"] { cursor: text !important; }
#ideaCursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; margin: -2px 0 0 -2px; pointer-events: none;
  z-index: 2147483647; opacity: 0; transition: opacity .15s; will-change: transform; }
#ideaCursor.on { opacity: 1; }
#ideaCursor svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.28)); }
#ideaCursor .ic-arrow { transform-origin: 2px 2px; transform-box: view-box; transition: transform .15s ease-out; animation: ic-hue 6s linear infinite; }
#ideaCursor.hot .ic-arrow { animation-duration: 2s; }
#ideaCursor.down .ic-arrow { transform: scale(.86); }
#ideaCursor .ic-bulb { fill: #fff6cc; animation: ic-glow 2.4s ease-in-out infinite; }
#ideaCursor .ic-halo { fill: #ffd54a; opacity: 0; transform-origin: 20px 18.5px; transform-box: view-box; animation: ic-halo 2.4s ease-in-out infinite; }
#ideaCursor .ic-rays { stroke-width: 1.6; stroke-linecap: round; opacity: 0; transform-origin: 20px 18.5px; transform-box: view-box;
  transition: opacity .15s; }
#ideaCursor.hot .ic-bulb { animation: none; fill: #ffcf33; }
#ideaCursor.hot .ic-halo { animation: ic-halo-hot 1s ease-in-out infinite; }
#ideaCursor.hot .ic-rays { opacity: 1; animation: ic-rays 1s ease-in-out infinite; }
#ideaCursor .ic-spark { fill: none; stroke: url(#icRainbow); stroke-width: 2.2; opacity: 0; transform-origin: 2px 2px; transform-box: view-box; }
#ideaCursor.click .ic-spark { animation: ic-spark .45s ease-out; }
@keyframes ic-hue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
@keyframes ic-glow { 0%, 100% { fill: #fffbe6; } 50% { fill: #ffe27a; } }
@keyframes ic-halo { 0%, 100% { opacity: 0; transform: scale(.8); } 50% { opacity: .35; transform: scale(1.15); } }
@keyframes ic-halo-hot { 0%, 100% { opacity: .35; transform: scale(1); } 50% { opacity: .55; transform: scale(1.3); } }
@keyframes ic-rays { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes ic-spark { 0% { opacity: .95; transform: scale(.2); } 100% { opacity: 0; transform: scale(1.6); } }`;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "ideaCursor"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<svg viewBox="0 0 28 28">
    <circle class="ic-spark" cx="2" cy="2" r="7"/>
    <defs><linearGradient id="icRainbow" x1="2" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff3d7f"/><stop offset=".28" stop-color="#ff9f1c"/><stop offset=".52" stop-color="#2ec4b6"/>
      <stop offset=".76" stop-color="#3a86ff"/><stop offset="1" stop-color="#8338ec"/></linearGradient></defs>
    <g class="ic-arrow"><path d="M2 2V19.5L6.6 15.4L9.7 22.4L12.9 21L9.9 14.2H16Z" fill="url(#icRainbow)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></g>
    <circle class="ic-halo" cx="20" cy="18.5" r="6.5"/>
    <g class="ic-rays"><path d="M20 10.6V9.2" stroke="#ff3d7f"/><path d="M25.6 12.9L26.6 11.9" stroke="#ff9f1c"/><path d="M27.9 18.5H29.3" stroke="#2ec4b6"/><path d="M14.4 12.9L13.4 11.9" stroke="#3a86ff"/><path d="M12.1 18.5H10.7" stroke="#8338ec"/></g>
    <circle class="ic-bulb" cx="20" cy="18.5" r="4.4" stroke="#26332f" stroke-width="1.3"/>
    <path d="M18.6 19.2L19.5 17.6L20.5 19.2L21.4 17.6" fill="none" stroke="#b07a00" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="18.1" y="22.6" width="3.8" height="2.6" rx=".8" fill="#26332f"/>
  </svg>`;
  const add = () => { document.body.appendChild(el); document.documentElement.classList.add("idea-cursor"); };
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
  document.addEventListener("mousedown", () => { el.classList.add("down"); el.classList.remove("click"); void el.offsetWidth; el.classList.add("click"); });
  document.addEventListener("mouseup", () => el.classList.remove("down"));
  el.addEventListener("animationend", e => { if (e.animationName === "ic-spark") el.classList.remove("click"); });
  document.documentElement.addEventListener("mouseleave", () => el.classList.remove("on"));
  window.addEventListener("blur", () => el.classList.remove("on"));
})();
