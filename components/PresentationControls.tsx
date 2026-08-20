"use client";

import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";

interface PresentationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  disabled?: boolean;
  light?: boolean; // true = white labels for dark fullscreen bg
}

export default function PresentationControls({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  isFullscreen,
  onToggleFullscreen,
  disabled = false,
  light = false,
}: PresentationControlsProps) {
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;
  const labelColor = light ? "text-white" : "text-charcoal";

  return (
    <div className="flex items-center justify-center gap-7">
      {/* Prev */}
      <button
        onClick={onPrev}
        disabled={disabled || !canPrev}
        aria-label="Previous slide"
        className={[
          "group flex items-center gap-2 transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/30 rounded-sm px-0.5",
          canPrev && !disabled
            ? "opacity-50 hover:opacity-90 cursor-pointer"
            : "opacity-15 cursor-not-allowed pointer-events-none",
        ].join(" ")}
      >
        <span className={`text-[10px] tracking-wider ${labelColor} transition-transform duration-200 group-hover:-translate-x-0.5`}>
          ←
        </span>
        <span className={`text-[8px] tracking-[0.25em] ${labelColor} font-light uppercase`}>
          Prev
        </span>
      </button>

      {/* Page counter */}
      <div className="flex items-baseline gap-1.5 min-w-[4rem] justify-center">
        <motion.span
          key={currentPage}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={`text-[11px] tracking-[0.08em] ${labelColor} font-light tabular-nums`}
        >
          {String(currentPage).padStart(2, "0")}
        </motion.span>
        <span className={`text-[9px] ${light ? "text-white/30" : "text-charcoal/25"} font-light`}>/</span>
        <span className={`text-[9px] tracking-[0.08em] ${light ? "text-white/40" : "text-charcoal/35"} font-light tabular-nums`}>
          {String(totalPages).padStart(2, "0")}
        </span>
      </div>

      {/* Next */}
      <button
        onClick={onNext}
        disabled={disabled || !canNext}
        aria-label="Next slide"
        className={[
          "group flex items-center gap-2 transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/30 rounded-sm px-0.5",
          canNext && !disabled
            ? "opacity-50 hover:opacity-90 cursor-pointer"
            : "opacity-15 cursor-not-allowed pointer-events-none",
        ].join(" ")}
      >
        <span className={`text-[8px] tracking-[0.25em] ${labelColor} font-light uppercase`}>
          Next
        </span>
        <span className={`text-[10px] tracking-wider ${labelColor} transition-transform duration-200 group-hover:translate-x-0.5`}>
          →
        </span>
      </button>

      {/* Separator */}
      <div className={`w-px h-3.5 ${light ? "bg-white/15" : "bg-charcoal/12"}`} />

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className={[
          "transition-opacity duration-200 p-1",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/30 rounded-sm",
          "opacity-35 hover:opacity-75",
        ].join(" ")}
      >
        {isFullscreen ? (
          <Minimize2
            size={11}
            className={light ? "text-white" : "text-charcoal"}
            strokeWidth={1.5}
          />
        ) : (
          <Maximize2
            size={11}
            className={light ? "text-white" : "text-charcoal"}
            strokeWidth={1.5}
          />
        )}
      </button>
    </div>
  );
}
