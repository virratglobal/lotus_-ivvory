"use client";

/**
 * CinematicPDFViewer
 * ──────────────────
 * Dual-canvas PDF renderer with GSAP-powered crossfade transitions.
 *
 * Architecture:
 *  • Two <canvas> elements (A and B) are always mounted, overlapping in the
 *    same viewport position.
 *  • The "front" canvas shows the current page at full opacity.
 *  • The "back" canvas is invisible (opacity 0) and pre-renders the NEXT page
 *    silently in the background BEFORE the transition animation starts.
 *  • When the user triggers a page change:
 *      1. Back canvas renders target page         (invisible, 0 opacity)
 *      2. GSAP animates back: opacity 0 → 1, scale 1.025 → 1, y ±20px → 0
 *      3. GSAP animates front: scale 1 → 0.975, y 0 → ±15px (stays visible)
 *      4. Near end: front fades from 1 → 0 (back is already fully opaque)
 *      5. Roles swap: A↔B. New front reset to {opacity:1,scale:1,y:0}.
 *  • Result: NO blank frame, NO blink. Both pages visible simultaneously.
 *
 * Exposed via forwardRef:
 *  • goNext() / goPrev()  — trigger one page transition (max 1 queued)
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";

// ─────────────────────────────────────────────────────────────
// PDF.js infrastructure (shared singletons)
// ─────────────────────────────────────────────────────────────
type PDFDoc = import("pdfjs-dist").PDFDocumentProxy;
type RenderTask = import("pdfjs-dist").RenderTask;

let _pdfjs: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  _pdfjs = lib;
  return lib;
}

// Document cache — keyed by URL. Both A/B canvases share the same doc.
const docCache = new Map<string, Promise<PDFDoc>>();

async function loadDoc(
  file: string,
  onProgress?: (pct: number) => void
): Promise<PDFDoc> {
  if (docCache.has(file)) return docCache.get(file)!;
  const lib = await getPdfjs();
  const task = lib.getDocument({
    url: file,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/cmaps/",
    cMapPacked: true,
  });
  if (onProgress) {
    task.onProgress = (d: { loaded: number; total: number }) => {
      if (d.total > 0) onProgress(Math.round((d.loaded / d.total) * 100));
    };
  }
  const p = task.promise;
  docCache.set(file, p);
  return p;
}

// Fire-and-forget page pre-fetch (warms pdfjs internal cache)
function prefetch(doc: PDFDoc, page: number) {
  if (page < 1 || page > doc.numPages) return;
  doc.getPage(page).catch(() => {});
}

// Render one PDF page to a canvas at a given CSS width.
// Returns { cssWidth, cssHeight } of the rendered output.
async function renderToCanvas(
  doc: PDFDoc,
  pageNum: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  existingTask: React.MutableRefObject<RenderTask | null>
): Promise<{ cssWidth: number; cssHeight: number }> {
  // Cancel any in-flight render on this canvas
  if (existingTask.current) {
    try { await existingTask.current.cancel(); } catch { /* expected */ }
    existingTask.current = null;
  }

  const page = await doc.getPage(pageNum);
  const dpr = Math.min(window.devicePixelRatio ?? 1, 3);
  const baseVp = page.getViewport({ scale: 1 });
  const scale = (cssWidth / baseVp.width) * dpr;
  const vp = page.getViewport({ scale });

  const cssH = Math.floor(vp.height / dpr);

  canvas.width  = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width  = `${cssWidth}px`;
  canvas.style.height = `${cssH}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { cssWidth, cssHeight: cssH };

  const task = page.render({ canvasContext: ctx, canvas, viewport: vp });
  existingTask.current = task;
  await task.promise;
  existingTask.current = null;

  return { cssWidth, cssHeight: cssH };
}

// ─────────────────────────────────────────────────────────────
// Public handle exposed via forwardRef
// ─────────────────────────────────────────────────────────────
export interface CinematicHandle {
  goNext: () => void;
  goPrev: () => void;
}

interface Props {
  file: string;
  initialPage?: number;
  containerWidth: number;
  onNumPages?: (n: number) => void;
  onCurrentPageChange?: (page: number) => void;
  onReady?: () => void;
  onLoadProgress?: (pct: number) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const CinematicPDFViewer = forwardRef<CinematicHandle, Props>(
  (
    {
      file,
      initialPage = 1,
      containerWidth,
      onNumPages,
      onCurrentPageChange,
      onReady,
      onLoadProgress,
    },
    ref
  ) => {
    // Two canvas refs — A starts as "front", B starts as "back"
    const canvasA = useRef<HTMLCanvasElement>(null);
    const canvasB = useRef<HTMLCanvasElement>(null);

    // Which canvas is currently the "front" (visible, full opacity)
    const frontIsA = useRef(true);

    // Active render tasks (one per canvas, so we can cancel)
    const taskA = useRef<RenderTask | null>(null);
    const taskB = useRef<RenderTask | null>(null);

    // Container height driven by first render
    const [containerHeight, setContainerHeight] = useState(0);

    // Internal state — all refs (no re-renders during animation)
    const docRef           = useRef<PDFDoc | null>(null);
    const currentPageRef   = useRef(initialPage);
    const totalPagesRef    = useRef(0);
    const isTransitioning  = useRef(false);
    const queuedDir        = useRef<"next" | "prev" | null>(null);
    const activeTl         = useRef<gsap.core.Timeline | null>(null);
    const isMounted        = useRef(true);

    // Stable function refs (so wheel/keyboard handlers are never re-added)
    const goNextFn = useRef<() => void>(() => {});
    const goPrevFn = useRef<() => void>(() => {});

    // ── Expose stable API ─────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        goNext: () => goNextFn.current(),
        goPrev: () => goPrevFn.current(),
      }),
      []
    );

    // ── Helpers ───────────────────────────────────────────────
    const getFront = () => (frontIsA.current ? canvasA.current : canvasB.current);
    const getBack  = () => (frontIsA.current ? canvasB.current : canvasA.current);
    const getBackTask  = () => (frontIsA.current ? taskB : taskA);

    // ── Core transition ───────────────────────────────────────
    const doTransition = useCallback(
      async (direction: "next" | "prev") => {
        const doc = docRef.current;
        if (!doc || !containerWidth || isTransitioning.current || !isMounted.current) return;

        const total   = totalPagesRef.current;
        const current = currentPageRef.current;

        if (direction === "next" && current >= total) return;
        if (direction === "prev" && current <= 1) return;

        const targetPage = direction === "next" ? current + 1 : current - 1;

        isTransitioning.current = true;

        const front    = getFront()!;
        const back     = getBack()!;
        const backTask = getBackTask();

        // ── Step 1: Position back canvas (invisible) ──
        // translateY starts from the direction of entry
        const enterY = direction === "next" ? 22 : -22;
        gsap.set(back, {
          opacity: 0,
          scale: 1.028,
          y: enterY,
          zIndex: 2,
        });

        // ── Step 2: Pre-render target page into back canvas ──
        // Back canvas is invisible (opacity 0) — user sees NOTHING of this
        try {
          const { cssHeight } = await renderToCanvas(
            doc,
            targetPage,
            back,
            containerWidth,
            backTask
          );
          if (!isMounted.current) { isTransitioning.current = false; return; }
          // Update container height if the new page is a different aspect ratio
          setContainerHeight(cssHeight);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "RenderingCancelledException") {
            isTransitioning.current = false;
            return;
          }
          console.error("[Cinematic] Pre-render error:", err);
          gsap.set(back, { opacity: 0, zIndex: 0 });
          isTransitioning.current = false;
          return;
        }

        // ── Step 3: GSAP crossfade ────────────────────────────
        // Back is fully rendered but invisible. Now animate simultaneously:
        // Back: fades/scales IN from its starting position
        // Front: subtly recedes (scale+y), then fades out after back is visible
        activeTl.current?.kill();

        const tl = gsap.timeline({
          onComplete: () => {
            if (!isMounted.current) return;

            // Commit page number
            currentPageRef.current = targetPage;
            onCurrentPageChange?.(targetPage);

            // Swap logical roles: back becomes the new front
            frontIsA.current = !frontIsA.current;

            // Reset the OLD front (now new back) to clean state
            const newBack = getBack()!;
            gsap.set(newBack, { opacity: 0, scale: 1, y: 0, zIndex: 0 });
            // Ensure new front has clean state
            const newFront = getFront()!;
            gsap.set(newFront, { opacity: 1, scale: 1, y: 0, zIndex: 1 });

            isTransitioning.current = false;

            // Prefetch ±1 pages
            prefetch(doc, targetPage - 1);
            prefetch(doc, targetPage + 1);

            // Process queued gesture
            if (queuedDir.current) {
              const qd = queuedDir.current;
              queuedDir.current = null;
              doTransition(qd);
            }
          },
        });

        activeTl.current = tl;

        // Back canvas: enters from direction (fades in, scales to 1, y to 0)
        // Duration: 0.72s — feels deliberate but not sluggish
        tl.to(
          back,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.72,
            ease: "power2.out",
          },
          0
        );

        // Front canvas: very subtle recession (stays opacity:1 until back covers it)
        // Scale down slightly, drift in exit direction
        tl.to(
          front,
          {
            scale: 0.974,
            y: direction === "next" ? -15 : 15,
            duration: 0.72,
            ease: "power2.inOut",
          },
          0
        );

        // Front opacity: fade OUT only after back is ~85% visible (at 0.55s mark)
        // This prevents ANY blank frame — back is nearly fully opaque before front fades
        tl.to(
          front,
          {
            opacity: 0,
            duration: 0.18,
            ease: "power1.in",
          },
          0.54 // ← fires at 0.54s, completes at 0.72s (same end time as back)
        );
      },
      [containerWidth, onCurrentPageChange]
    );

    // Keep stable function refs up-to-date
    useEffect(() => {
      goNextFn.current = () => {
        if (isTransitioning.current) {
          // Queue at most one direction — prevents multi-page jumps
          queuedDir.current = "next";
        } else {
          doTransition("next");
        }
      };
      goPrevFn.current = () => {
        if (isTransitioning.current) {
          queuedDir.current = "prev";
        } else {
          doTransition("prev");
        }
      };
    }, [doTransition]);

    // ── Initial mount: set GSAP start states ──────────────────
    useLayoutEffect(() => {
      if (canvasA.current) {
        gsap.set(canvasA.current, { opacity: 1, scale: 1, y: 0, zIndex: 1 });
      }
      if (canvasB.current) {
        gsap.set(canvasB.current, { opacity: 0, scale: 1, y: 0, zIndex: 0 });
      }
    }, []);

    // ── Load PDF & render first page ─────────────────────────
    useEffect(() => {
      if (!containerWidth) return;

      isMounted.current = true;
      let cancelled = false;

      // Reset state for new file
      isTransitioning.current = false;
      queuedDir.current = null;
      activeTl.current?.kill();
      frontIsA.current = true;

      // Reset canvas states for new file
      if (canvasA.current) gsap.set(canvasA.current, { opacity: 1, scale: 1, y: 0, zIndex: 1 });
      if (canvasB.current) gsap.set(canvasB.current, { opacity: 0, scale: 1, y: 0, zIndex: 0 });

      (async () => {
        try {
          const doc = await loadDoc(file, onLoadProgress);
          if (cancelled || !isMounted.current) return;

          docRef.current = doc;
          totalPagesRef.current = doc.numPages;
          onNumPages?.(doc.numPages);

          const front = getFront()!;
          if (!front) return;

          const frontTask = frontIsA.current ? taskA : taskB;
          const { cssHeight } = await renderToCanvas(
            doc,
            initialPage,
            front,
            containerWidth,
            frontTask
          );
          if (cancelled || !isMounted.current) return;

          setContainerHeight(cssHeight);
          currentPageRef.current = initialPage;
          onCurrentPageChange?.(initialPage);
          onReady?.();

          // Prefetch neighbours
          prefetch(doc, initialPage + 1);
          prefetch(doc, initialPage - 1);
        } catch (err) {
          if (!cancelled) console.error("[Cinematic] Load error:", err);
        }
      })();

      return () => {
        cancelled = true;
      };
    // Re-run when file or containerWidth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, containerWidth]);

    // ── Re-render on resize (containerWidth change, same file) ─
    useEffect(() => {
      const doc = docRef.current;
      if (!doc || !containerWidth || isTransitioning.current) return;

      const front = getFront()!;
      if (!front) return;

      const frontTask = frontIsA.current ? taskA : taskB;

      renderToCanvas(doc, currentPageRef.current, front, containerWidth, frontTask)
        .then(({ cssHeight }) => {
          if (isMounted.current) setContainerHeight(cssHeight);
        })
        .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerWidth]);

    // ── Cleanup ───────────────────────────────────────────────
    useEffect(() => {
      return () => {
        isMounted.current = false;
        activeTl.current?.kill();
      };
    }, []);

    // ── Render ────────────────────────────────────────────────
    return (
      <div
        style={{
          position: "relative",
          width: containerWidth > 0 ? containerWidth : "100%",
          height: containerHeight > 0 ? containerHeight : undefined,
          // Subtle shadow on the presentation frame
          filter: "drop-shadow(0 6px 48px rgba(0,0,0,0.09))",
        }}
      >
        {/* Canvas A */}
        <canvas
          ref={canvasA}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            willChange: "transform, opacity",
            transformOrigin: "center center",
          }}
          aria-label="Presentation slide"
        />
        {/* Canvas B */}
        <canvas
          ref={canvasB}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            opacity: 0,
            willChange: "transform, opacity",
            transformOrigin: "center center",
          }}
          aria-hidden="true"
        />
      </div>
    );
  }
);

CinematicPDFViewer.displayName = "CinematicPDFViewer";
export default CinematicPDFViewer;
