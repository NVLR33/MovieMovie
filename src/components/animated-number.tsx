'use client';

import { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value?: number;
  duration?: number;
  decimals?: number;
}

export function AnimatedNumber({
  value = 0,
  duration = 1200,
  decimals = 0,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const targetValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    let startTime: number | null = null;
    let animationFrameId: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(targetValue * easeProgress);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  return <span>{displayValue.toFixed(decimals)}</span>;
}
