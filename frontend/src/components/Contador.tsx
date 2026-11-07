"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function Contador({
  valor,
  formato = (n: number) => String(Math.round(n)),
}: {
  valor: number;
  formato?: (n: number) => string;
}) {
  const reducir = useReducedMotion();
  const [mostrado, setMostrado] = useState(0);

  useEffect(() => {
    if (reducir) return;
    const control = animate(0, valor, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setMostrado,
    });
    return () => control.stop();
  }, [valor, reducir]);

  return <span className="tabular-nums">{formato(reducir ? valor : mostrado)}</span>;
}
