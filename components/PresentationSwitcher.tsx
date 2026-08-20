"use client";

import { motion } from "framer-motion";
import { Presentation } from "@/lib/presentations";

interface PresentationSwitcherProps {
  presentations: Presentation[];
  activeId: string;
  onSwitch: (id: string) => void;
  disabled?: boolean;
}

export default function PresentationSwitcher({
  presentations,
  activeId,
  onSwitch,
  disabled = false,
}: PresentationSwitcherProps) {
  const activeIndex = presentations.findIndex((p) => p.id === activeId);
  const pct = (activeIndex / presentations.length) * 100;

  return (
    <nav
      aria-label="Presentation selector"
      className="relative flex items-stretch border border-charcoal/[0.10] bg-ivory/80"
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* Sliding active indicator */}
      <motion.div
        className="absolute inset-y-0 bg-charcoal/[0.04] border-charcoal/[0.08]"
        style={{
          width: `${100 / presentations.length}%`,
          borderLeftWidth: activeIndex === 0 ? 0 : 1,
          borderRightWidth: activeIndex === presentations.length - 1 ? 0 : 1,
        }}
        animate={{ left: `${pct}%` }}
        transition={{ duration: 0.42, ease: [0.25, 0.1, 0.25, 1] }}
      />

      {presentations.map((p, i) => {
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => !disabled && !isActive && onSwitch(p.id)}
            disabled={disabled || isActive}
            aria-pressed={isActive}
            aria-label={`Switch to ${p.title}`}
            className={[
              "relative flex items-center gap-2.5 px-5 py-2.5",
              "transition-colors duration-300 select-none",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/20",
              i < presentations.length - 1 ? "border-r border-charcoal/[0.08]" : "",
              disabled ? "cursor-not-allowed" : isActive ? "cursor-default" : "cursor-pointer",
            ].join(" ")}
          >
            {/* Number */}
            <span
              className={[
                "font-light tabular-nums text-[9px] tracking-[0.22em] transition-colors duration-350",
                isActive ? "text-charcoal/55" : "text-charcoal/28",
              ].join(" ")}
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            {/* Hairline divider */}
            <span
              className={[
                "w-px h-3 transition-colors duration-350",
                isActive ? "bg-charcoal/18" : "bg-charcoal/10",
              ].join(" ")}
            />

            {/* Title */}
            <span
              className={[
                "text-[9px] tracking-[0.20em] uppercase font-light whitespace-nowrap transition-colors duration-350",
                isActive ? "text-charcoal" : "text-charcoal/38",
              ].join(" ")}
            >
              {p.shortTitle}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
