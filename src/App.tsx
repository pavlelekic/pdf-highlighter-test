import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Highlight,
  PdfHighlighter,
  PdfLoader,
  type IHighlight,
  type Scaled,
} from "react-pdf-highlighter";
import { GlobalWorkerOptions } from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
  TextItem,
} from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "react-pdf-highlighter/dist/style.css";

const PDF_URL = "/sdi.pdf";
const PAGE_BREAK = "\n\n";
const MIN_QUERY_LENGTH = 2;

GlobalWorkerOptions.workerSrc = pdfjsWorker;

type ScaledRect = Scaled & { pageNumber: number };

type IndexedSpan = {
  start: number;
  end: number;
  pageNumber: number;
  rect: ScaledRect;
};

type PageSpan = Omit<IndexedSpan, "start" | "end"> & {
  start: number;
  end: number;
};

type IndexedDocument = {
  text: string;
  spans: IndexedSpan[];
};

type IndexStatus = "idle" | "indexing" | "ready" | "error";

const loaderStyles: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: "320px",
  fontSize: "0.95rem",
  color: "#4b5563",
};
const buttonStyles: CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.9rem",
  fontSize: "0.95rem",
  background: "#f8fafc",
  color: "#0f172a",
  cursor: "pointer",
};
const EMPTY_HIGHLIGHTS: IHighlight[] = [];

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [indexStatus, setIndexStatus] = useState<IndexStatus>("idle");
  const [indexedDocument, setIndexedDocument] =
    useState<IndexedDocument | null>(null);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [searching, setSearching] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const [documentVersion, setDocumentVersion] = useState(0);
  const scrollToHighlight = useRef<((highlight: IHighlight) => void) | null>(
    null,
  );

  useEffect(() => {
    const pdfDocument = pdfDocumentRef.current;
    if (!pdfDocument) {
      return;
    }

    let cancelled = false;
    setIndexStatus("indexing");
    setIndexError(null);

    buildTextIndex(pdfDocument)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIndexedDocument(result);
        setIndexStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setIndexedDocument(null);
        setIndexStatus("error");
        setIndexError(
          error instanceof Error ? error.message : "Failed to index PDF text",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [documentVersion]);

  const handleSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalizedQuery = searchTerm.trim();
      if (
        !indexedDocument ||
        !normalizedQuery ||
        normalizedQuery.length < MIN_QUERY_LENGTH
      ) {
        setHighlights([]);
        return;
      }

      setSearching(true);
      const newHighlights = findHighlights(indexedDocument, normalizedQuery);
      setHighlights(newHighlights);
      setSearching(false);

      if (newHighlights.length && scrollToHighlight.current) {
        scrollToHighlight.current(newHighlights[0]);
      }
    },
    [indexedDocument, searchTerm],
  );

  const helperText = useMemo(() => {
    if (indexStatus === "indexing") {
      return "Indexing PDF text…";
    }
    if (indexStatus === "error") {
      return indexError ?? "Unable to read PDF text.";
    }
    if (highlights.length && !searching) {
      return `${highlights.length} highlight${highlights.length === 1 ? "" : "s"} found.`;
    }
    if (indexStatus === "ready" && !highlights.length) {
      return "Enter at least two characters and search.";
    }
    return "";
  }, [indexStatus, indexError, highlights.length, searching]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1.5rem",
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          PDF search & highlight
        </h1>
        <form
          onSubmit={handleSearch}
          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
        >
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Paste multi-paragraph text…"
            style={{
              flex: "1 1 320px",
              padding: "0.5rem",
              fontSize: "1rem",
              border: "1px solid #cbd5f5",
              borderRadius: "0.375rem",
            }}
          />
          <button
            style={buttonStyles}
            type="submit"
            disabled={
              !viewerReady ||
              indexStatus !== "ready" ||
              searching ||
              searchTerm.trim().length < MIN_QUERY_LENGTH
            }
          >
            {searching ? "Searching…" : "Search"}
          </button>
          <button
            style={{ ...buttonStyles, background: "transparent" }}
            type="button"
            disabled={!highlights.length}
            onClick={() => {
              setHighlights([]);
            }}
          >
            Clear
          </button>
        </form>
        {helperText ? (
          <p style={{ fontSize: "0.9rem", color: "#475569", margin: 0 }}>
            {helperText}
          </p>
        ) : null}
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <PdfLoader
          url={PDF_URL}
          beforeLoad={<div style={loaderStyles}>Loading PDF…</div>}
        >
          {(pdfDocument) => (
            <PdfWorkspace
              pdfDocument={pdfDocument}
              highlights={highlights}
              viewerReady={viewerReady}
              registerDocument={(doc) => {
                if (pdfDocumentRef.current !== doc) {
                  pdfDocumentRef.current = doc;
                  setIndexedDocument(null);
                  setHighlights([]);
                  setDocumentVersion((value) => value + 1);
                  setViewerReady(false);
                }
              }}
              scrollRef={(scrollFn) => {
                scrollToHighlight.current = scrollFn;
                setViewerReady(Boolean(scrollFn));
              }}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
}

type PdfWorkspaceProps = {
  pdfDocument: PDFDocumentProxy;
  highlights: IHighlight[];
  viewerReady: boolean;
  registerDocument: (doc: PDFDocumentProxy) => void;
  scrollRef: (scrollTo: (highlight: IHighlight) => void) => void;
};

function PdfWorkspace({
  pdfDocument,
  highlights,
  viewerReady,
  registerDocument,
  scrollRef,
}: PdfWorkspaceProps) {
  useEffect(() => {
    registerDocument(pdfDocument);
  }, [pdfDocument, registerDocument]);

  const renderedHighlights = viewerReady ? highlights : EMPTY_HIGHLIGHTS;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        height: "100%",
      }}
    >
      <PdfHighlighter
        pdfDocument={pdfDocument}
        pdfScaleValue="auto"
        enableAreaSelection={() => false}
        onSelectionFinished={() => null}
        scrollRef={scrollRef}
        highlights={renderedHighlights}
        onScrollChange={() => undefined}
        highlightTransform={(
          highlight,
          index,
          _setTip,
          _hideTip,
          _viewportToScaled,
          _screenshot,
          isScrolledTo,
        ) => (
          <Highlight
            key={highlight.id ?? index}
            isScrolledTo={isScrolledTo}
            position={highlight.position}
            comment={highlight.comment}
          />
        )}
      />
    </div>
  );
}

async function buildTextIndex(
  pdfDocument: PDFDocumentProxy,
): Promise<IndexedDocument> {
  const spans: IndexedSpan[] = [];
  const textParts: string[] = [];
  let offset = 0;

  for (
    let pageNumber = 1;
    pageNumber <= pdfDocument.numPages;
    pageNumber += 1
  ) {
    const page = await pdfDocument.getPage(pageNumber);
    const pageData = await extractPageText(page, pageNumber);

    pageData.spans.forEach((span) => {
      spans.push({
        pageNumber: span.pageNumber,
        rect: span.rect,
        start: span.start + offset,
        end: span.end + offset,
      });
    });

    textParts.push(pageData.text);
    offset += pageData.text.length;

    if (pageNumber < pdfDocument.numPages) {
      textParts.push(PAGE_BREAK);
      offset += PAGE_BREAK.length;
    }
  }

  return { text: textParts.join(""), spans };
}

type PageExtraction = {
  text: string;
  spans: PageSpan[];
};

async function extractPageText(
  page: PDFPageProxy,
  pageNumber: number,
): Promise<PageExtraction> {
  const textContent = await page.getTextContent({ includeMarkedContent: true });
  const viewport = page.getViewport({ scale: 1 });
  const spans: PageSpan[] = [];
  const textSegments: string[] = [];
  let cursor = 0;

  textContent.items.forEach((item) => {
    if (!isTextItem(item)) {
      return;
    }

    const cleaned = normalizeSpaces(item.str);
    if (!cleaned.length) {
      return;
    }

    const start = cursor;
    textSegments.push(cleaned);
    cursor += cleaned.length;

    spans.push({
      pageNumber,
      start,
      end: cursor,
      rect: textItemToRect(item, viewport, pageNumber),
    });

    if (item.hasEOL) {
      textSegments.push("\n");
      cursor += 1;
    }
  });

  return { text: textSegments.join(""), spans };
}

function findHighlights(index: IndexedDocument, query: string): IHighlight[] {
  const regex = buildQueryRegex(query);
  if (!regex) {
    return [];
  }

  const results: IHighlight[] = [];
  const { text, spans } = index;
  let matchIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const coverSpans = spans.filter(
      (span) => span.end > start && span.start < end,
    );
    if (!coverSpans.length) {
      continue;
    }

    const spansByPage = groupByPage(coverSpans);
    const matchedText = text.slice(start, end);

    spansByPage.forEach((pageSpans) => {
      const rects = pageSpans.map((span) => span.rect);
      const boundingRect = combineRects(rects);
      const id = `match-${matchIndex}-${pageSpans[0]?.pageNumber ?? "p"}`;

      results.push({
        id,
        content: { text: matchedText },
        comment: { text: "Search match", emoji: "🔍" },
        position: {
          pageNumber: pageSpans[0]?.pageNumber ?? 1,
          rects,
          boundingRect,
          usePdfCoordinates: true,
        },
      });
    });

    matchIndex += 1;
  }

  return results;
}

function buildQueryRegex(query: string): RegExp | null {
  const pieces = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);

  if (!pieces.length) {
    return null;
  }

  const pattern = pieces.join("\\s+");
  return new RegExp(pattern, "gi");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function combineRects(rects: ScaledRect[]): ScaledRect {
  const [first] = rects;
  if (!first) {
    return {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      width: 1,
      height: 1,
      pageNumber: 1,
    };
  }

  const baseWidth = first.width;
  const baseHeight = first.height;
  const pageNumber = first.pageNumber;

  return rects.reduce<ScaledRect>(
    (acc, rect) => ({
      x1: Math.min(acc.x1, rect.x1),
      y1: Math.min(acc.y1, rect.y1),
      x2: Math.max(acc.x2, rect.x2),
      y2: Math.max(acc.y2, rect.y2),
      width: baseWidth,
      height: baseHeight,
      pageNumber: rect.pageNumber ?? pageNumber,
    }),
    {
      x1: first.x1,
      y1: first.y1,
      x2: first.x2,
      y2: first.y2,
      width: baseWidth,
      height: baseHeight,
      pageNumber,
    },
  );
}

function groupByPage(spans: IndexedSpan[]): IndexedSpan[][] {
  const map = new Map<number, IndexedSpan[]>();
  spans.forEach((span) => {
    const existing = map.get(span.pageNumber);
    if (existing) {
      existing.push(span);
    } else {
      map.set(span.pageNumber, [span]);
    }
  });
  return Array.from(map.values());
}

function isTextItem(item: TextContent["items"][number]): item is TextItem {
  return (item as TextItem).str !== undefined;
}

function normalizeSpaces(text: string): string {
  return text.replace(/\u00a0/g, " ");
}

function textItemToRect(
  item: TextItem,
  viewport: PageViewport,
  pageNumber: number,
): ScaledRect {
  const x = item.transform[4];
  const y = item.transform[5];
  const width = (item.width ?? 0) || Math.abs(item.transform[0]);
  const height = (item.height ?? 0) || Math.abs(item.transform[3]);
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
    x,
    y,
    x + width,
    y + height,
  ]);
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  return {
    x1: minX,
    y1: minY,
    x2: maxX,
    y2: maxY,
    width: viewport.width,
    height: viewport.height,
    pageNumber,
  };
}

export default App;
