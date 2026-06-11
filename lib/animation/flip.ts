import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

let registered = false;

if (typeof window !== 'undefined' && !registered) {
  gsap.registerPlugin(Flip);
  registered = true;
}

export { gsap, Flip };
