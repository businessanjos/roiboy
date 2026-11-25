import { useEffect, useRef, useState } from 'react';

/** Measure natural calls content in layout pixels, not the transformed TV image. */
export function useTvRowContentHeight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const row = ref.current;
    if (!enabled || !row) return;
    let frame: number | undefined;
    const observed = new Set<HTMLElement>();

    const measure = () => {
      frame = undefined;
      const targets = new Set<HTMLElement>([row]);
      let required = 0;
      for (const calls of row.querySelectorAll<HTMLElement>('.commercial-calls')) {
        const sellers = calls.querySelector<HTMLElement>('.commercial-calls-sellers');
        const card = calls.closest<HTMLElement>('[data-tv-visual]');
        if (!sellers || !card) continue;
        targets.add(calls); targets.add(sellers); targets.add(card);
        const style = getComputedStyle(calls);
        const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        const chrome = Math.max(0, card.offsetHeight - calls.clientHeight);
        // scrollHeight includes unused viewport space, so use the natural seller list.
        required = Math.max(required, Math.ceil(sellers.offsetHeight + padding + chrome + 2));
      }
      for (const column of row.querySelectorAll<HTMLElement>('.insights-tv-presentation .company-ranking-column-content')) {
        const list = column.querySelector<HTMLOListElement>('ol');
        const header = column.querySelector<HTMLElement>('header');
        const card = column.closest<HTMLElement>('[data-tv-visual]');
        const ranking = column.closest<HTMLElement>('.company-ranking');
        if (!list || !header || !card || !ranking) continue;
        targets.add(list); targets.add(header); targets.add(card);
        const headerStyle = getComputedStyle(header);
        const chrome = Math.max(0, card.offsetHeight - ranking.clientHeight);
        required = Math.max(required, Math.ceil(list.offsetHeight + header.offsetHeight + (parseFloat(headerStyle.marginBottom) || 0) + chrome + 2));
      }
      for (const target of observed) {
        if (!targets.has(target)) { resize.unobserve(target); observed.delete(target); }
      }
      for (const target of targets) {
        if (!observed.has(target)) { observed.add(target); resize.observe(target); }
      }
      setHeight(previous => previous === required ? previous : required);
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(row, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      resize.disconnect(); mutations.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return { ref, height: enabled ? height : 0 };
}