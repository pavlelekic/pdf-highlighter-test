import { useState } from "react";
import { searchPdf } from "../utils/pdfSearch";

export function usePdfSearch() {
  const [highlights, setHighlights] = useState<any[]>([]);

  async function findHighlights(pdfUrl: string, term: string) {
    try {
      console.log("Starting search for:", term);
      const buffer = await fetch(pdfUrl).then((r) => r.arrayBuffer());
      console.log("PDF buffer loaded, size:", buffer.byteLength);

      const result = await searchPdf(buffer, term);
      console.log("Search results:", result);

      setHighlights(Array.isArray(result) ? result : []);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("Error searching PDF:", error);
      setHighlights([]);
      return [];
    }
  }

  return { highlights, findHighlights };
}
