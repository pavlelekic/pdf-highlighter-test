import { useEffect, useState } from "react";
import { PdfHighlighter, Highlight } from "react-pdf-highlighter";

async function searchPdfInBrowser(pdfBuffer: ArrayBuffer, term: string) {
  return new Promise((resolve) => {
    const worker = new Worker("/search-worker.js");

    worker.postMessage({ pdfBuffer, searchTerm: term });

    worker.onmessage = (event) => {
      resolve(event.data.highlights);
      worker.terminate();
    };
  });
}

function App() {
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    (async () => {
      const buffer = await fetch("/sdi.pdf").then((r) => r.arrayBuffer());
      const found = await searchPdfInBrowser(buffer, "your long search text…");
      setHighlights(found);
    })();
  }, []);

  return (
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
  );
}

export default App;
