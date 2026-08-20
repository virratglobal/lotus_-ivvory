"use client";

/**
 * PresentationViewer
 * ──────────────────
 * Dual-Experience Luxury Hospitality Presentation Shell.
 *
 * Desktop Presentation Deck Canvas (75-80% proportional scale with generous outer whitespace)
 * Mobile & Touch Optimized: zero horizontal overflow, compact switcher, responsive touch controls.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import ContinuousPDFViewer from "./ContinuousPDFViewer";
import StitchBrandExperience from "./StitchBrandExperience";
import PresentationSwitcher from "./PresentationSwitcher";
import LoadingScreen from "./LoadingScreen";
import { PRESENTATIONS } from "@/lib/presentations";
import { useAudio } from "@/hooks/useAudio";
import { Maximize2, Minimize2, ArrowUp } from "lucide-react";

interface PresState {
  currentPage: number;
  totalPages: number;
}

function initPresStates(): Record<string, PresState> {
  return Object.fromEntries(
    PRESENTATIONS.map((p) => [p.id, { currentPage: 1, totalPages: 1 }])
  );
}

export default function PresentationViewer() {
  // ── Global audio (uninterrupted across presentation switches) ─────
  const { isPlaying: isAudioPlaying, toggle: toggleAudio } = useAudio(
    "/ivory-lotus-jingle.mp3",
    0.20
  );

  // ── Presentation state ────────────────────────────────────
  const [activeId, setActiveId] = useState(PRESENTATIONS[0].id);
  const [presStates, setPresStates] = useState<Record<string, PresState>>(initPresStates);
  const [isSwitching, setIsSwitching] = useState(false);

  // ── Loading ───────────────────────────────────────────────
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fullscreen & Scroll ───────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stitchScrollPosRef = useRef<number>(0);

  // ── Container measurement (PDF mode) ──────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ── Scroll hint & back to top state ───────────────────────
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Measure container width for responsive PDF scaling
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    const { width } = el.getBoundingClientRect();
    if (width > 0) setContainerWidth(width);
    return () => ro.disconnect();
  }, [isFullscreen]);

  // Ensure web fonts are fully loaded before finalizing layout measurements
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        const el = containerRef.current;
        if (el) {
          const w = el.getBoundingClientRect().width;
          if (w > 0) setContainerWidth(w);
        }
      });
    }
  }, []);

  // Handle scroll events in main viewport
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (activeId === "presentation-02") {
      stitchScrollPosRef.current = container.scrollTop;
    }

    if (container.scrollTop > 100) {
      setShowScrollHint(false);
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  }, [activeId]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await viewerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Presentation switcher handler (01 ↔ 02)
  const handleSwitch = useCallback(
    (newId: string) => {
      if (newId === activeId || isSwitching) return;

      if (activeId === "presentation-02" && scrollContainerRef.current) {
        stitchScrollPosRef.current = scrollContainerRef.current.scrollTop;
      }

      setIsSwitching(true);

      if (newId === "presentation-01") {
        setIsLoading(true);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        setIsLoading(false);
      }

      setTimeout(() => {
        setActiveId(newId);
        setShowScrollHint(true);

        if (newId === "presentation-02") {
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                top: stitchScrollPosRef.current,
                behavior: stitchScrollPosRef.current > 0 ? "smooth" : "auto",
              });
            }
          }, 50);
        }

        setTimeout(() => {
          setIsSwitching(false);
        }, 150);
      }, 400);
    },
    [activeId, isSwitching]
  );

  // Scroll to top button handler
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // PDF Callbacks for Presentation 01
  const handleNumPages = useCallback(
    (n: number) => {
      setPresStates((prev) => ({
        ...prev,
        ["presentation-01"]: { ...prev["presentation-01"], totalPages: n },
      }));
    },
    []
  );

  const handleActivePageChange = useCallback(
    (pageNumber: number) => {
      setPresStates((prev) => ({
        ...prev,
        ["presentation-01"]: { ...prev["presentation-01"], currentPage: pageNumber },
      }));
    },
    []
  );

  const handleReady = useCallback(() => {
    setIsLoading(false);
    setIsSwitching(false);
  }, []);

  const handleLoadProgress = useCallback((pct: number) => {
    setLoadProgress(pct);
  }, []);

  const activePresentation = PRESENTATIONS.find((p) => p.id === activeId)!;
  const isPdfMode = activeId === "presentation-01";
  const pdfState = presStates["presentation-01"];

  return (
    <>
      <LoadingScreen visible={isPdfMode && isLoading} progress={loadProgress} />

      <div
        ref={viewerRef}
        className={[
          "relative flex flex-col h-screen w-full select-none overflow-hidden",
          isFullscreen ? "bg-[#111110]" : "bg-background",
        ].join(" ")}
      >
        {/* ── Fixed Top Header Navigation (Fixed z-[100] with mobile responsive padding) ── */}
        <AnimatePresence>
          {!isFullscreen && (
            <motion.header
              key="global-nav"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-3 sm:px-6 md:px-10 h-14 border-b border-charcoal/[0.08] bg-ivory/95 backdrop-blur-md"
            >
              {/* Left: Ivorry Lotus logo */}
              <button
                onClick={() => handleSwitch("presentation-01")}
                className="flex items-center gap-1.5 sm:gap-2.5 focus-visible:outline-none rounded-sm min-h-[40px]"
              >
                <svg viewBox="0 0 120 120" className="w-6 h-6 sm:w-7 sm:h-7 opacity-70" aria-hidden="true">
                  <ellipse cx="60" cy="60" rx="6" ry="22" fill="#4A5E4A" opacity="0.18" />
                  <ellipse cx="60" cy="60" rx="6" ry="22" fill="#4A5E4A" opacity="0.18" transform="rotate(45 60 60)" />
                  <ellipse cx="60" cy="60" rx="6" ry="22" fill="#4A5E4A" opacity="0.18" transform="rotate(90 60 60)" />
                  <ellipse cx="60" cy="60" rx="6" ry="22" fill="#4A5E4A" opacity="0.18" transform="rotate(135 60 60)" />
                  <ellipse cx="60" cy="60" rx="4" ry="16" fill="#4A5E4A" opacity="0.5" transform="rotate(22.5 60 60)" />
                  <ellipse cx="60" cy="60" rx="4" ry="16" fill="#4A5E4A" opacity="0.5" transform="rotate(67.5 60 60)" />
                  <ellipse cx="60" cy="60" rx="4" ry="16" fill="#4A5E4A" opacity="0.5" transform="rotate(112.5 60 60)" />
                  <ellipse cx="60" cy="60" rx="4" ry="16" fill="#4A5E4A" opacity="0.5" transform="rotate(157.5 60 60)" />
                  <circle cx="60" cy="60" r="6" fill="#4A5E4A" opacity="0.65" />
                  <circle cx="60" cy="60" r="3" fill="#C9A96E" opacity="0.85" />
                </svg>
                <span className="hidden md:block text-[9px] tracking-[0.3em] text-charcoal/70 font-light uppercase">
                  Ivorry Lotus
                </span>
              </button>

              {/* Center: Presentation Switcher */}
              <div className="absolute left-1/2 -translate-x-1/2">
                <PresentationSwitcher
                  presentations={PRESENTATIONS}
                  activeId={activeId}
                  onSwitch={handleSwitch}
                  disabled={isSwitching}
                />
              </div>

              {/* Right: Private label · Sound toggle · Fullscreen */}
              <div className="flex items-center gap-1.5 sm:gap-3">
                <span className="hidden lg:block text-[8px] tracking-[0.32em] text-charcoal/30 font-light uppercase">
                  Private Presentation
                </span>
                <span className="hidden lg:block w-px h-3 bg-charcoal/10" />

                {/* Audio toggle — GLOBAL SOUND ON / SOUND OFF */}
                <button
                  onClick={toggleAudio}
                  aria-label={isAudioPlaying ? "Turn sound off" : "Turn sound on"}
                  aria-pressed={isAudioPlaying}
                  className={[
                    "flex items-center gap-1 sm:gap-1.5 transition-all duration-300 min-h-[40px] px-1.5 py-1",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-charcoal/15 rounded-sm",
                    isAudioPlaying ? "opacity-85 hover:opacity-100" : "opacity-40 hover:opacity-75",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-[10px] leading-none transition-colors duration-300 select-none",
                      isAudioPlaying ? "text-botanical font-bold" : "text-charcoal/60",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    ♪
                  </span>
                  <span
                    className={[
                      "text-[8px] tracking-[0.24em] font-light uppercase transition-colors duration-300",
                      isAudioPlaying ? "text-charcoal/90 font-medium" : "text-charcoal/45",
                    ].join(" ")}
                  >
                    {isAudioPlaying ? "ON" : "OFF"}
                  </span>
                </button>

                <span className="hidden sm:block w-px h-3 bg-charcoal/10" />

                <button
                  onClick={toggleFullscreen}
                  aria-label="Enter fullscreen"
                  className="hidden sm:flex opacity-35 hover:opacity-75 transition-opacity duration-200 p-1.5 min-h-[40px] items-center justify-center focus-visible:outline-none rounded-sm"
                >
                  <Maximize2 size={12} className="text-charcoal" strokeWidth={1.5} />
                </button>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* ── Main Scrollable Viewport Container (pt-14 below fixed header) ── */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 pt-14 overflow-y-auto overflow-x-hidden scroll-smooth w-full h-full"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <AnimatePresence mode="wait">
            {isPdfMode ? (
              /* Presentation 01 — Continuous PDF Presentation */
              <motion.div
                key="presentation-01"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex justify-center px-2 sm:px-4 md:px-6 lg:px-8 min-h-full"
              >
                <div
                  ref={containerRef}
                  className={[
                    "relative w-full flex flex-col items-center",
                    isFullscreen ? "max-w-[96vw]" : "max-w-[1340px]",
                  ].join(" ")}
                >
                  {containerWidth > 0 && (
                    <ContinuousPDFViewer
                      file={activePresentation.file}
                      containerWidth={containerWidth}
                      onNumPages={handleNumPages}
                      onActivePageChange={handleActivePageChange}
                      onReady={handleReady}
                      onLoadProgress={handleLoadProgress}
                    />
                  )}
                </div>
              </motion.div>
            ) : (
              /* Presentation 02 — Native Stitch Brand Experience Webpage */
              <motion.div
                key="presentation-02"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full min-h-full flex flex-col items-center justify-start bg-ivory-dark/25 py-0 md:py-8 lg:py-12 px-0 md:px-6 lg:px-12 transition-all duration-300"
              >
                <div className="w-full max-w-[1140px] min-h-full relative shadow-none md:shadow-[0_16px_55px_rgba(0,0,0,0.08)] rounded-none md:rounded-xl border-none md:border md:border-charcoal/[0.08] overflow-hidden bg-background">
                  <StitchBrandExperience />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Floating Controls (Page Counter for PDF & Back to Top) ── */}
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-ivory/85 md:bg-ivory/90 backdrop-blur-md border border-charcoal/10 shadow-sm">
          {isPdfMode && !isLoading && (
            <div className="flex items-baseline gap-1.5 px-2">
              <span className="text-[10px] tracking-[0.14em] text-charcoal/70 font-light tabular-nums">
                {String(pdfState.currentPage).padStart(2, "0")}
              </span>
              <span className="text-[8px] text-charcoal/25 font-light">/</span>
              <span className="text-[9px] tracking-[0.1em] text-charcoal/40 font-light tabular-nums">
                {String(pdfState.totalPages).padStart(2, "0")}
              </span>
            </div>
          )}

          {!isPdfMode && (
            <span className="text-[9px] tracking-[0.2em] text-charcoal/60 font-light uppercase px-2">
              Brand Experience
            </span>
          )}

          {showScrollTop && (
            <button
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="flex items-center justify-center p-1.5 text-charcoal/50 hover:text-charcoal transition-colors duration-200 min-h-[32px] min-w-[32px]"
            >
              <ArrowUp size={12} strokeWidth={1.5} />
            </button>
          )}

          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              aria-label="Exit fullscreen"
              className="flex items-center justify-center p-1.5 text-charcoal/50 hover:text-charcoal transition-colors duration-200 min-h-[32px] min-w-[32px]"
            >
              <Minimize2 size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* ── Scroll hint ─────────────────────────────────── */}
        <AnimatePresence>
          {showScrollHint && (!isPdfMode || !isLoading) && (
            <motion.div
              key="scroll-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ delay: 1.2, duration: 0.7 }}
              className="fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none z-20"
            >
              <span className="text-[7px] tracking-[0.38em] text-charcoal/30 font-light uppercase">
                Scroll to explore
              </span>
              <motion.span
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 2.0, ease: "easeInOut" }}
                className="text-[11px] leading-none text-charcoal/25"
              >
                ↓
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
