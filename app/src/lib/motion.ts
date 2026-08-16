import { useEffect, useRef } from 'react';

/**
 * Motion, gated so it can only ever add.
 *
 * The failure mode of scroll animation is content that never appears — a
 * reveal that starts at opacity 0 and waits for JavaScript will hide the page
 * outright if the observer never runs, the script fails, or the reader has
 * reduced motion on. On a page whose subject is a public record, invisible
 * content is not a cosmetic bug.
 *
 * So the hidden state lives behind `html[data-motion="on"]`, and that attribute
 * is only set once we have confirmed the environment can animate AND that the
 * reader has not asked us not to. No attribute, no hiding: the page renders as
 * plain static content and every word is readable.
 */
const canAnimate =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canAnimate) {
  document.documentElement.setAttribute('data-motion', 'on');
}

export const motionEnabled = canAnimate;

/**
 * Reveal an element once, when it first enters the viewport.
 *
 * Unobserves immediately after firing — a record does not need to re-animate
 * every time you scroll back past it, and re-triggering reads as a page that
 * cannot settle.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!canAnimate) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-in', 'true');
          io.unobserve(entry.target);
        }
      },
      // Fire a little before the element is fully in view, so the motion has
      // finished by the time it is actually being read.
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
