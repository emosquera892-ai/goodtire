import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export const ROJO = "#ff453a";

export const claseCampo = (error?: boolean) =>
  `w-full rounded-full border bg-white/[0.04] px-3.5 py-1.5 text-[14px] text-porcelain outline-none transition placeholder:text-slate focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-apple-blue ${
    error ? "border-[#ff453a]" : "border-slate"
  }`;

export function Campo({
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="min-w-0">
      <input {...props} aria-invalid={!!error} className={`${claseCampo(!!error)} ${className}`} />
      {error && <p className="mt-1 px-1 text-[12px] text-[#ff453a]">{error}</p>}
    </div>
  );
}

type Variante = "primario" | "secundario" | "enlace" | "peligro";

const variantes: Record<Variante, string> = {
  primario: "bg-apple-blue text-white hover:brightness-110",
  secundario: "border border-slate text-porcelain hover:bg-white/5",
  enlace: "text-electric-link hover:underline",
  peligro: "border border-[#ff453a] text-[#ff453a] hover:bg-[#ff453a]/10",
};

export function Boton({
  variante = "primario",
  className = "",
  activo,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; activo?: boolean }) {
  const forma = variante === "enlace" ? "px-1 py-1" : "rounded-full px-4 py-2";
  return (
    <button
      type="button"
      aria-pressed={activo}
      {...props}
      className={`${forma} text-[14px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-blue disabled:cursor-not-allowed disabled:opacity-50 ${activo ? "border border-apple-blue bg-apple-blue/45 font-medium text-white" : variantes[variante]} ${className}`}
    />
  );
}

export function BotonQuitar(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="mt-0.5 h-8 w-8 rounded-full text-ash transition hover:bg-white/10 hover:text-porcelain focus-visible:outline-2 focus-visible:outline-apple-blue disabled:cursor-not-allowed disabled:opacity-30"
    >
      ✕
    </button>
  );
}

export function Seccion({
  id,
  titulo,
  nota,
  acciones,
  children,
  className = "",
}: {
  id?: string;
  titulo: string;
  nota?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">{titulo}</h3>
          {nota && <p className="mt-2 max-w-2xl text-[14px] leading-[1.29] tracking-[-0.224px] text-ash">{nota}</p>}
        </div>
        {acciones}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export const Th = ({ children }: { children?: ReactNode }) => (
  <span className="px-1 text-[12px] tracking-[-0.12px] text-ash">{children}</span>
);
