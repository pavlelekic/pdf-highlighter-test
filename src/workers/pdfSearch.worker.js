// src/workers/pdfSearch.worker.js
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker?worker";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// --------------------------------------------------
// Extract text + mapping
// --------------------------------------------------
async function extractPages(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((i) => i.str).join("");

    pages.push({
      pageNumber: n,
      text,
      items: content.items,
    });
  }

  return pages;
}

// Map every character in entire PDF → item & position
function buildCharMap(pages) {
  let fullText = "";
  const map = [];

  for (const p of pages) {
    for (const item of p.items) {
      for (let i = 0; i < item.str.length; i++) {
        map.push({
          globalIndex: fullText.length + i,
          pageNumber: p.pageNumber,
          item,
          charIndex: i,
        });
      }
    }
    fullText += p.text;
  }

  return { fullText, map };
}

// Multi-paragraph / multiline search
function findOccurrences(fullText, term) {
  const escaped = term.trim().replace(/\s+/g, "\\s+");
  const re = new RegExp(escaped, "gi");

  const out = [];
  let m;
  while ((m = re.exec(fullText)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

// Convert char range → page rectangles for highlighting
function matchToRects(match, map) {
  const slice = map.slice(match.start, match.end);
  const pages = new Map();

  for (const entry of slice) {
    if (!pages.has(entry.pageNumber)) pages.set(entry.pageNumber, []);
    pages.get(entry.pageNumber).push(entry);
  }

  const result = [];

  for (const [pageNumber, entries] of pages) {
    const groups = [];
    let group = [entries[0]];

    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const cur = entries[i];

      if (prev.item === cur.item && cur.charIndex === prev.charIndex + 1) {
        group.push(cur);
      } else {
        groups.push(group);
        group = [cur];
      }
    }
    groups.push(group);

    const rects = groups.map((g) => {
      const item = g[0].item;
      const t = item.transform;

      return {
        x: t[4],
        y: t[5] + t[3],
        width: item.width,
        height: item.height,
      };
    });

    result.push({ pageNumber, rects });
  }

  return result;
}

onmessage = async (e) => {
  const { pdfBuffer, searchTerm } = e.data;

  const pages = await extractPages(pdfBuffer);
  const { fullText, map } = buildCharMap(pages);
  const occurrences = findOccurrences(fullText, searchTerm);

  const highlights = occurrences.map((occ, i) => ({
    id: `h-${i}`,
    text: searchTerm,
    positions: matchToRects(occ, map),
  }));

  postMessage({ highlights });
};
