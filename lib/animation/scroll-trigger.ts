import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

// Register ScrollTrigger only on the client — accessing window in SSR/Node would crash.
if (typeof window !== 'undefined' && !registered) {
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export { gsap, ScrollTrigger };
