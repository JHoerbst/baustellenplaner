import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Scan, X } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { useApp } from '../lib/app';
import type { Attachment } from '../lib/types';

/** Resolution of the overview; sharpness comes from the detail canvas, see below. */
const MAX_PIXEL = 4e6;
/** How far you can zoom in beyond "whole plan visible". */
const MAX_ZOOM = 60;
/** How long the view has to rest before the detail is redrawn. */
const SETTLE_MS = 120;

type View = { x: number; y: number; k: number };
type RenderTask = { cancel: () => void; promise: Promise<void> };

// pdf.js is large - load it only when a PDF is actually opened.
async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument(url).promise;
}

type Point = { x: number; y: number };

/**
 * Full-screen view of a plan (PDF or image): drag to pan, two fingers,
 * mouse wheel or double tap to zoom.
 */
export function PlanViewer({ title, attachment, group, onClose }: { title: string; attachment: Attachment; group: string; onClose: () => void }) {
  const { store } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const detailCanvas = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, Point>());
  /** Scale at which the whole plan fits the stage. */
  const fitScale = useRef(1);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  /** View for which the sharp detail was last drawn. */
  const [sharpView, setSharpView] = useState<View | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [t, setT] = useState<View>({ x: 0, y: 0, k: 1 });
  const [failure, setFailure] = useState('');

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);

  // Fetch the file: PDFs go to pdf.js, everything else is shown as an image.
  useEffect(() => {
    let cancelled = false;
    let pdfDocument: PDFDocumentProxy | undefined;
    let url = '';
    (async () => {
      try {
        url = await store.fileUrl(group, attachment);
        if (cancelled) return;
        if (/\.pdf$/i.test(attachment.name)) {
          pdfDocument = await loadPdf(url);
          if (cancelled) return void pdfDocument.destroy();
          setPdf(pdfDocument);
        } else {
          setImageUrl(url);
        }
      } catch (e) {
        if (!cancelled) setFailure(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      pdfDocument?.destroy();
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [store, group, attachment]);

  // Overview of the current PDF page at moderate resolution. It sits below
  // the sharp detail and is what you see during a gesture.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    (async () => {
      try {
        const next = await pdf.getPage(pageNumber);
        if (cancelled || !canvas.current) return;
        const baseViewport = next.getViewport({ scale: 1 });
        const sharpness = Math.min(3, Math.sqrt(MAX_PIXEL / (baseViewport.width * baseViewport.height)));
        const scaledViewport = next.getViewport({ scale: sharpness });
        const c = canvas.current;
        c.width = Math.floor(scaledViewport.width);
        c.height = Math.floor(scaledViewport.height);
        renderTask = next.render({ canvasContext: c.getContext('2d')!, viewport: scaledViewport });
        await renderTask.promise;
        if (cancelled) return;
        setPage(next);
        setPageSize({ w: baseViewport.width, h: baseViewport.height });
      } catch (e) {
        if (!cancelled) setFailure(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  // The actual vector zoom: once the view rests briefly, pdf.js redraws
  // exactly the visible region at screen resolution. The canvas is never
  // larger than the stage, no matter how far in you are.
  useEffect(() => {
    if (!page || !pageSize) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    const timer = setTimeout(async () => {
      const b = stage.current;
      const targetCanvas = detailCanvas.current;
      if (!b || !targetCanvas) return;
      const dpr = window.devicePixelRatio || 1;
      // Draw into a buffer first, then copy - otherwise the canvas flashes blank.
      const buffer = document.createElement('canvas');
      buffer.width = Math.round(b.clientWidth * dpr);
      buffer.height = Math.round(b.clientHeight * dpr);
      const scaledViewport = page.getViewport({ scale: t.k * dpr, offsetX: t.x * dpr, offsetY: t.y * dpr });
      try {
        renderTask = page.render({ canvasContext: buffer.getContext('2d')!, viewport: scaledViewport });
        await renderTask.promise;
      } catch {
        return; // cancelled because the view has already changed again
      }
      if (cancelled) return;
      targetCanvas.width = buffer.width;
      targetCanvas.height = buffer.height;
      // pdf.js fills the whole canvas white; only the page's area is copied over.
      const x0 = Math.max(0, Math.ceil(t.x * dpr));
      const y0 = Math.max(0, Math.ceil(t.y * dpr));
      const x1 = Math.min(buffer.width, Math.floor((t.x + pageSize.w * t.k) * dpr));
      const y1 = Math.min(buffer.height, Math.floor((t.y + pageSize.h * t.k) * dpr));
      if (x1 > x0 && y1 > y0) {
        targetCanvas.getContext('2d')!.drawImage(buffer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      }
      setSharpView(t);
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      renderTask?.cancel();
    };
  }, [page, pageSize, t]);

  const fitToStage = useCallback(() => {
    const b = stage.current;
    if (!b || !pageSize) return;
    const k = Math.min(b.clientWidth / pageSize.w, b.clientHeight / pageSize.h);
    fitScale.current = k;
    setT({ k, x: (b.clientWidth - pageSize.w * k) / 2, y: (b.clientHeight - pageSize.h * k) / 2 });
  }, [pageSize]);

  useEffect(() => {
    fitToStage();
    window.addEventListener('resize', fitToStage);
    return () => window.removeEventListener('resize', fitToStage);
  }, [fitToStage]);

  /** Zooms around a point on the stage (default: centre), which stays in place. */
  const zoom = useCallback((factor: number, around?: Point) => {
    const b = stage.current!;
    const p = around ?? { x: b.clientWidth / 2, y: b.clientHeight / 2 };
    setT((previous) => {
      const k = Math.min(Math.max(previous.k * factor, fitScale.current * 0.8), fitScale.current * MAX_ZOOM);
      const f = k / previous.k;
      return { k, x: p.x - (p.x - previous.x) * f, y: p.y - (p.y - previous.y) * f };
    });
  }, []);

  const toStage = (x: number, y: number): Point => {
    const r = stage.current!.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  };

  // Mouse wheel and trackpad pinch (arrives as wheel with ctrlKey). Registered
  // by hand because React attaches wheel passively, which would make
  // preventDefault a no-op.
  useEffect(() => {
    const b = stage.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), toStage(e.clientX, e.clientY));
    };
    b.addEventListener('wheel', onWheel, { passive: false });
    return () => b.removeEventListener('wheel', onWheel);
  }, [zoom]);

  function onDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const all = pointers.current;
    const previous = all.get(e.pointerId);
    if (!previous) return;
    const next = { x: e.clientX, y: e.clientY };
    all.set(e.pointerId, next);

    if (all.size === 1) {
      setT((s) => ({ ...s, x: s.x + next.x - previous.x, y: s.y + next.y - previous.y }));
    } else if (all.size === 2) {
      // Two fingers: distance changes the scale, the midpoint moves along.
      const other = [...all].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const now = Math.hypot(next.x - other.x, next.y - other.y);
      setT((s) => ({ ...s, x: s.x + (next.x - previous.x) / 2, y: s.y + (next.y - previous.y) / 2 }));
      if (before > 0) zoom(now / before, toStage((next.x + other.x) / 2, (next.y + other.y) / 2));
    }
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => pointers.current.delete(e.pointerId);

  function goToPage(toPage: number) {
    setPageSize(null);
    setPage(null);
    setSharpView(null);
    setPageNumber(toPage);
  }

  return (
    <dialog
      ref={dialog}
      className="viewer"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="viewer-header">
        <strong>{title}</strong>
        {pdf && pdf.numPages > 1 && (
          <span className="viewer-pages">
            <button type="button" className="icon-btn" disabled={pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)} aria-label="Vorige Seite">
              <ChevronLeft size={20} />
            </button>
            {pageNumber} / {pdf.numPages}
            <button type="button" className="icon-btn" disabled={pageNumber >= pdf.numPages} onClick={() => goToPage(pageNumber + 1)} aria-label="Nächste Seite">
              <ChevronRight size={20} />
            </button>
          </span>
        )}
        <button type="button" className="icon-btn" onClick={() => zoom(1 / 1.5)} aria-label="Verkleinern">
          <Minus size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={() => zoom(1.5)} aria-label="Vergrößern">
          <Plus size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={fitToStage} aria-label="Ganzen Plan zeigen">
          <Scan size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
          <X size={20} />
        </button>
      </header>

      <div
        ref={stage}
        className="stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) =>
          t.k > fitScale.current * 1.5 ? fitToStage() : zoom(3, toStage(e.clientX, e.clientY))
        }
      >
        <div
          className="stage-plan"
          style={{
            width: pageSize?.w,
            height: pageSize?.h,
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
            visibility: pageSize ? 'visible' : 'hidden',
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              draggable={false}
              onLoad={(e) => setPageSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailure('Das Bild lässt sich nicht anzeigen.')}
            />
          ) : (
            <canvas ref={canvas} />
          )}
        </div>
        {/* Between two redraws the old detail follows along via CSS. */}
        {pdf && (
          <canvas
            ref={detailCanvas}
            className="stage-detail"
            style={
              sharpView
                ? {
                    transform: `translate(${t.x - (sharpView.x * t.k) / sharpView.k}px, ${t.y - (sharpView.y * t.k) / sharpView.k}px) scale(${t.k / sharpView.k})`,
                  }
                : { visibility: 'hidden' }
            }
          />
        )}
        {failure ? <p className="stage-status error">{failure}</p> : !pageSize && <p className="stage-status">Lädt …</p>}
      </div>
    </dialog>
  );
}
