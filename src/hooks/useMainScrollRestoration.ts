import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { MAIN_SCROLL_ID } from "@/lib/navigation/scrollMain";
import { navigationScrollTop } from "@/lib/navigation/mobileNavigation";

const positions = new Map<string, number>();

/** Restore only the shell scroller; chat, kanban and nested tables retain ownership. */
export function useMainScrollRestoration() {
  const location = useLocation();
  const action = useNavigationType();
  useLayoutEffect(() => {
    const main = document.getElementById(MAIN_SCROLL_ID);
    if (!main || location.pathname === "/roy-zapp" || location.pathname.startsWith("/roy-zapp/")) return;
    const top = navigationScrollTop(action, positions.get(location.key));
    let frame = 0;
    if (top !== null) {
      main.scrollTop = top;
      // Lazy pages can arrive after the layout commit. Retry only until scroll fits,
      // and immediately yield to touch/wheel/key input.
      const started = performance.now();
      const restore = () => {
        main.scrollTop = top;
        if (main.scrollTop < top && performance.now() - started < 2000) frame = requestAnimationFrame(restore);
      };
      frame = requestAnimationFrame(restore);
    }
    const stop = () => cancelAnimationFrame(frame);
    const save = () => positions.set(location.key, main.scrollTop);
    main.addEventListener("scroll", save, { passive: true });
    main.addEventListener("touchstart", stop, { passive: true });
    main.addEventListener("wheel", stop, { passive: true });
    main.addEventListener("keydown", stop);
    return () => {
      stop();
      positions.set(location.key, main.scrollTop);
      if (positions.size > 100) positions.delete(positions.keys().next().value as string);
      main.removeEventListener("scroll", save);
      main.removeEventListener("touchstart", stop);
      main.removeEventListener("wheel", stop);
      main.removeEventListener("keydown", stop);
    };
  }, [location.key, location.pathname, action]);
}