"use client";

import { useEffect } from "react";

// Progressive enhancement: [data-reveal] blocks are fully visible without JS
// (opacity:1). Once mounted we add `js` to <html> — which arms the hidden→reveal
// transition — then reveal each block as it scrolls into view. No inline script, so
// the strict nonce CSP is untouched. Honors prefers-reduced-motion via CSS.
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });

  return null;
}
