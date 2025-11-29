import { PdfHighlighter, Highlight } from "react-pdf-highlighter";
import { usePdfSearch } from "./hooks/usePdfSearch";
import "react-pdf-highlighter/dist/style.css";

export default function PdfDemo() {
  const { highlights, findHighlights } = usePdfSearch();

  return (
    <div
      style={{ width: "100%", height: "100vh", overflow: "auto", padding: 16 }}
    >
      <button
        onClick={() =>
          findHighlights("/sdi.pdf", "your long multi paragraph text")
        }
      >
        Search
      </button>
      <div style={{ position: "relative", height: "100vh" }}>
        <PdfHighlighter
          pdfDocument="/sdi.pdf"
          highlights={highlights}
          highlightTransform={(h) => (
            <Highlight
              key={h.id}
              position={{
                pageNumber: h.positions[0].pageNumber,
                rects: h.positions.flatMap((p) => p.rects),
              }}
            />
          )}
        />
      </div>
    </div>
  );
}
