import { useEffect, useRef, useState } from "react";

/**
 * The layout renders each page twice (phone and desktop) and hides one with CSS.
 * Anything that opens by itself (a full-screen player, a composer from ?mode=) should only run in the copy
 * that's on screen: attach `ref` to the page and check `shown`.
 */
export function useShown<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const check = () => setShown(!!ref.current && ref.current.getClientRects().length > 0);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return { ref, shown };
}
