"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reducir = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yFondo = useTransform(scrollYProgress, [0, 1], [0, reducir ? 0 : 140]);
  const yTexto = useTransform(scrollYProgress, [0, 1], [0, reducir ? 0 : -60]);
  const opacidad = useTransform(scrollYProgress, [0, 0.8], [1, reducir ? 1 : 0]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[calc(100svh-2.75rem)] items-center justify-center overflow-hidden">
      <motion.div
        aria-hidden
        style={{ y: yFondo }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[38%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-apple-blue/20 blur-[140px]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="rejilla" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#f5f5f7" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rejilla)" />
        </svg>
      </motion.div>

      <motion.div style={{ y: yTexto, opacity: opacidad }} className="mx-auto max-w-5xl px-6 text-center">
        <motion.p
          initial={reducir ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-[19px] font-semibold tracking-[0.228px] text-porcelain"
        >
          Good Tire, Inc.
        </motion.p>
        <motion.h1
          initial={reducir ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 text-[clamp(44px,9vw,96px)] font-semibold leading-[1.04] tracking-[-0.015em] text-porcelain"
        >
          Dónde abrir.
          <br />
          Cuánto ahorrar.
        </motion.h1>
        <motion.p
          initial={reducir ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="mx-auto mt-6 max-w-xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash"
        >
          Optimización matemática que decide qué almacenes construir para atender todos los clientes al menor
          costo mensual.
        </motion.p>
        <motion.div
          initial={reducir ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/resolver"
            className="rounded-full bg-apple-blue px-5 py-2.5 text-[14px] text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-blue"
          >
            Resolver el caso
          </Link>
          <Link
            href="/reglas"
            className="rounded-full border border-slate px-5 py-2.5 text-[14px] text-porcelain transition hover:bg-white/5"
          >
            Qué puedes introducir
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
