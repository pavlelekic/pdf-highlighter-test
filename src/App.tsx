import { PdfHighlighter, Highlight, PdfLoader } from "react-pdf-highlighter";
import { usePdfSearch } from "./hooks/usePdfSearch";
import "react-pdf-highlighter/dist/style.css";

interface SearchHighlight {
  id: string;
  text: string;
  positions: Array<{
    pageNumber: number;
    rects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }>;
}

export default function PdfDemo() {
  const { highlights, findHighlights } = usePdfSearch();

  return (
    <div
      style={{ width: "100%", height: "100vh", overflow: "auto", padding: 16 }}
    >
      <button onClick={() => findHighlights("/sdi.pdf", "This is a quick")}>
        Search
      </button>
      <div style={{ position: "relative", height: "100vh" }}>
        <PdfLoader
          url="/sdi.pdf"
          beforeLoad={<div>Loading PDF...</div>}
          workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs"
        >
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              highlights={highlights}
              onScrollChange={() => {}}
              scrollRef={() => {}}
              onSelectionFinished={() => null}
              enableAreaSelection={() => false}
              highlightTransform={(h: SearchHighlight) => (
                <Highlight
                  key={h.id}
                  isScrolledTo={false}
                  position={{
                    boundingRect: {
                      left: h.positions[0].rects[0].x,
                      top: h.positions[0].rects[0].y,
                      width: h.positions[0].rects[0].width,
                      height: h.positions[0].rects[0].height,
                      pageNumber: h.positions[0].pageNumber,
                    },
                    rects: h.positions.flatMap((p) =>
                      p.rects.map((r) => ({
                        left: r.x,
                        top: r.y,
                        width: r.width,
                        height: r.height,
                        pageNumber: p.pageNumber,
                      })),
                    ),
                  }}
                  comment={{
                    text: h.text,
                    emoji: "",
                  }}
                />
              )}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
}
