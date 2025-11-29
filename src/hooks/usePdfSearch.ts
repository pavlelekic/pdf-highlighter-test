import { useState } from "react";
import { searchPdf } from "../utils/pdfSearch";

export function usePdfSearch() {
  const [highlights, setHighlights] = useState([]);

  async function findHighlights(pdfUrl: string, term: string) {
    const buffer = await fetch(pdfUrl).then((r) => r.arrayBuffer());

    const result = await searchPdf(buffer, term);

    setHighlights(result);
    return result;
  }

  return { highlights, findHighlights };
}
