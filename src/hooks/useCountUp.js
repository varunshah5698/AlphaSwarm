import { useEffect, useRef, useState } from 'react';

// Animates a number toward its target whenever the target changes (ease-out cubic).
export function useCountUp(value, duration = 650) {
  const target = Number(value);
  const isNumber = Number.isFinite(target);
  const [display, setDisplay] = useState(isNumber ? target : 0);
  const fromRef = useRef(isNumber ? target : 0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!isNumber) return undefined;
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, isNumber]);

  return isNumber ? display : value;
}

export default useCountUp;
