"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

interface SinglePageProps {
  doc: PDFDoc;
  pageNumber: number;
  containerWidth: number;
  aspectRatio: number;
  onVisible: (pageNumber: number) => void;
}

function ContinuousPDFPage({
  doc,
  pageNumber,
  containerWidth,
  aspectRatio,
  onVisible,
}: SinglePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [shouldRender, setShouldRender] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  // 1. Intersection Observer for lazy rendering & page visibility tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Render observer (with 600px margin before entering viewport)
    const renderObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setShouldRender(true);
        }
      },
      { rootMargin: "600px 0px 600px 0px" }
    );

    // Active page indicator observer (when page takes up significant viewport area)
    const activeObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onVisible(pageNumber);
        }
      },
      { threshold: 0.35 }
    );

    renderObserver.observe(el);
    activeObserver.observe(el);

    return () => {
      renderObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [pageNumber, onVisible]);

  // 2. Render logic using PDF.js when shouldRender becomes true or width changes
  const renderCanvas = useCallback(async () => {
    if (!shouldRender || !canvasRef.current || containerWidth <= 0) return;

    if (renderTaskRef.current) {
      try {
        await renderTaskRef.current.cancel();
      } catch {
        // Cancelled expected
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await doc.getPage(pageNumber);
      if (!canvasRef.current) return;

      const dpr = Math.min(window.devicePixelRatio ?? 1, 3);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = (containerWidth / baseVp.width) * dpr;
      const vp = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cssHeight = Math.floor(vp.height / dpr);

      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const task = page.render({ canvasContext: ctx, canvas, viewport: vp });
      renderTaskRef.current = task;

      await task.promise;
      renderTaskRef.current = null;
      setIsRendered(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "RenderingCancelledException") {
        return;
      }
      console.error(`[ContinuousPDFPage] Page ${pageNumber} render error:`, err);
    }
  }, [doc, pageNumber, containerWidth, shouldRender]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const calculatedHeight =
    containerWidth > 0 && aspectRatio > 0
      ? containerWidth / aspectRatio
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full shadow-[0_8px_35px_rgba(0,0,0,0.06)] rounded-sm overflow-hidden bg-ivory-dark/30 transition-opacity duration-500"
      style={{
        width: containerWidth > 0 ? `${containerWidth}px` : "100%",
        height: calculatedHeight ? `${calculatedHeight}px` : "auto",
        aspectRatio: aspectRatio > 0 ? `${aspectRatio}` : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        className={`block w-full h-full transition-opacity duration-500 ${
          isRendered ? "opacity-100" : "opacity-0"
        }`}
        aria-label={`Slide ${pageNumber}`}
      />

      {/* Placeholder before rendering */}
      {!isRendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-ivory-dark/30 animate-pulse">
          <span className="text-[9px] tracking-[0.25em] text-charcoal/20 uppercase font-light">
            {String(pageNumber).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  );
}

interface ContinuousPDFViewerProps {
  file: string;
  containerWidth: number;
  onNumPages: (numPages: number) => void;
  onActivePageChange: (pageNumber: number) => void;
  onReady: () => void;
  onLoadProgress: (pct: number) => void;
}

export default function ContinuousPDFViewer({
  file,
  containerWidth,
  onNumPages,
  onActivePageChange,
  onReady,
  onLoadProgress,
}: ContinuousPDFViewerProps) {
  const [doc, setDoc] = useState<PDFDoc | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);

    (async () => {
      try {
        const pdfDoc = await loadDoc(file, onLoadProgress);
        if (cancelled) return;

        setDoc(pdfDoc);
        setNumPages(pdfDoc.numPages);
        onNumPages(pdfDoc.numPages);

        // Fetch page 1 aspect ratio
        const page1 = await pdfDoc.getPage(1);
        const vp = page1.getViewport({ scale: 1 });
        if (vp.width && vp.height) {
          setAspectRatio(vp.width / vp.height);
        }

        onReady();
      } catch (err) {
        if (!cancelled) console.error("[ContinuousPDFViewer] Load error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, onNumPages, onReady, onLoadProgress]);

  const handlePageVisible = useCallback(
    (pageNumber: number) => {
      onActivePageChange(pageNumber);
    },
    [onActivePageChange]
  );

  if (!doc || numPages === 0) return null;

  const pagesArray = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center gap-10 md:gap-16 w-full py-6 md:py-12">
      {pagesArray.map((pageNum) => (
        <ContinuousPDFPage
          key={`${file}-page-${pageNum}`}
          doc={doc}
          pageNumber={pageNum}
          containerWidth={containerWidth}
          aspectRatio={aspectRatio}
          onVisible={handlePageVisible}
        />
      ))}
    </div>
  );
}
