() => {
  const vw = document.documentElement.clientWidth;
  const main = document.getElementById(document.querySelector('main')?.id || '') || document.querySelector('main');
  const desc = (e) => {
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    const c = (e.getAttribute('class') || '').trim().split(/\s+/).slice(0, 8).join('.');
    if (c) s += '.' + c;
    const t = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return s + (t ? ` "${t}"` : '');
  };
  const clipped = (e) => {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a === main) return false;
      const st = getComputedStyle(a);
      if (['auto', 'scroll', 'hidden', 'clip'].includes(st.overflowX)) {
        const r = a.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return st.overflowX;
      }
      if (st.position === 'fixed') return false;
    }
    return false;
  };
  const offenders = [];
  const all = document.querySelectorAll('body *');
  for (const e of all) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const st = getComputedStyle(e);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    if (e.closest('[aria-hidden="true"]') && st.position !== 'fixed') {}
    if (clipped(e)) continue;
    const p = e.parentElement; const pr = p?.getBoundingClientRect();
    const parentAlso = pr && (pr.right > vw + 1 || pr.left < -1) && !clipped(p) && p !== main && p.tagName !== 'BODY';
    if (parentAlso) continue;
    const chain=[];for(let a=e.parentElement,i=0;a&&a!==main&&i<4;a=a.parentElement,i++)chain.push(desc(a).slice(0,70));
    offenders.push({ chain, el: desc(e), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), pos: st.position, minW: st.minWidth, width: st.width });
    if (offenders.length > 12) break;
  }
  const shifted = [];
  for (const e of all) { if (e.scrollLeft > 0 && getComputedStyle(e).overflowX !== 'auto' && getComputedStyle(e).overflowX !== 'scroll') shifted.push(desc(e) + ' scrollLeft=' + e.scrollLeft); }
  const ancestorsShift = [];
  for (let a = main; a; a = a.parentElement) if (a.scrollLeft) ancestorsShift.push(desc(a) + ' ' + a.scrollLeft);
  let drill=null;
  if (main && main.scrollWidth > main.clientWidth + 1 && !offenders.length) {
    const base=main.scrollWidth; drill=[]; let node=main;
    for (let d=0; d<25; d++) { let f=null; for (const c of node.children) { const o=c.style.display; c.style.display='none'; const sw=main.scrollWidth; c.style.display=o; if (sw<base) { f=c; break; } } if (!f) break; drill.push(desc(f).slice(0,90)); node=f; }
  }
  return {
    drill,
    vw, docSW: document.documentElement.scrollWidth, bodySW: document.body.scrollWidth, scrollX: window.scrollX,
    mainCW: main?.clientWidth, mainSW: main?.scrollWidth, mainSL: main?.scrollLeft, mainOX: main && getComputedStyle(main).overflowX,
    offenders, shifted: shifted.slice(0, 6), ancestorsShift,
  };
}
