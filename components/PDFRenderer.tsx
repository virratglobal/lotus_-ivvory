"use client";

import { useEffect, useRef, useCallback } from "react";

interface PDFRendererProps {
  file: string;
  pageNumber: number;
  containerWidth: number;
  onNumPages: (n: number) => void;
  onLoadProgress?: (pct: number) => void;
  onPageRendered?: () => void;
}

// ── Singleton PDF.js loader ──────────────────────────────────
let _pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  _pdfjsLib = pdfjs;
  return pdfjs;
}

// ── Document cache (keyed by URL) ────────────────────────────
const docCache = new Map<
  string,
  Promise<import("pdfjs-dist").PDFDocumentProxy>
>();

async function loadDocument(
  file: string,
  onProgress?: (pct: number) => void
): Promise<import("pdfjs-dist").PDFDocumentProxy> {
  if (docCache.has(file)) return docCache.get(file)!;

  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({
    url: file,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/cmaps/",
    cMapPacked: true,
  });

  if (onProgress) {
    task.onProgress = (data: { loaded: number; total: number }) => {
      if (data.total > 0) {
        onProgress(Math.round((data.loaded / data.total) * 100));
      }
    };
  }

  const promise = task.promise;
  docCache.set(file, promise);
  return promise;
}

// ── Prefetch helper (fire-and-forget) ───────────────────────
async function prefetchPage(
  doc: import("pdfjs-dist").PDFDocumentProxy,
  page: number
) {
  if (page < 1 || page > doc.numPages) return;
  try {
    await doc.getPage(page);
  } catch {
    // Silently ignore prefetch errors
  }
}

// ────────────────────────────────────────────────────────────
export default function PDFRenderer({
  file,
  pageNumber,
  containerWidth,
  onNumPages,
  onLoadProgress,
  onPageRendered,
}: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const mountedRef = useRef(true);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Core render function ───────────────────────────────────
  const renderPage = useCallback(
    async (
      doc: import("pdfjs-dist").PDFDocumentProxy,
      page: number,
      width: number
    ) => {
      if (!canvasRef.current || !mountedRef.current || width <= 0) return;

      // Cancel any in-flight render first
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch {
          // RenderingCancelledException — expected
        }
        renderTaskRef.current = null;
      }

      const pdfPage = await doc.getPage(page);
      if (!mountedRef.current || !canvasRef.current) return;

      const dpr = Math.min(window.devicePixelRatio ?? 1, 3); // cap at 3× for perf
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const scale = (width / baseViewport.width) * dpr;
      const viewport = pdfPage.getViewport({ scale });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Physical pixel dimensions
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // CSS dimensions (logical pixels)
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const task = pdfPage.render({ canvasContext: ctx, canvas, viewport });
      renderTaskRef.current = task;

      try {
        await task.promise;
        renderTaskRef.current = null;
        if (mountedRef.current) {
          onPageRendered?.();
          // Prefetch adjacent pages
          prefetchPage(doc, page - 1);
          prefetchPage(doc, page + 1);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name !== "RenderingCancelledException"
        ) {
          console.error("[PDFRenderer] render error:", err);
        }
      }
    },
    [onPageRendered]
  );

  // ── Load document when file changes ──────────────────────
  useEffect(() => {
    if (!containerWidth) return;
    let cancelled = false;

    (async () => {
      try {
        const doc = await loadDocument(file, onLoadProgress);
        if (cancelled || !mountedRef.current) return;
        docRef.current = doc;
        onNumPages(doc.numPages);
        await renderPage(doc, pageNumber, containerWidth);
      } catch (err) {
        if (!cancelled) console.error("[PDFRenderer] load error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, containerWidth]);

  // ── Re-render when page number changes ───────────────────
  useEffect(() => {
    if (!docRef.current || !containerWidth) return;
    renderPage(docRef.current, pageNumber, containerWidth);
  }, [pageNumber, renderPage, containerWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="block max-w-full shadow-[0_4px_40px_rgba(0,0,0,0.08)]"
      aria-label={`Slide ${pageNumber}`}
    />
  );
}
