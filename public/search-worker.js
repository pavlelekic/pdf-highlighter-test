importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js");
importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js");

const pdfjsLib = window["pdfjs-dist/build/pdf"];

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";

// -----------------------------------------------
// Extract text + positions
// -----------------------------------------------
async function extractPdf(pagesList) {
  const { pdfBuffer } = pagesList;
  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = content.items;
    let text = "";
    for (const item of items) text += item.str;

    pages.push({ pageNumber, text, items });
  }

  return pages;
}

// -----------------------------------------------
// Build continuous string + mapping
// -----------------------------------------------
function buildMapping(pages) {
  let fullText = "";
  const map = [];

  for (const p of pages) {
    for (const item of p.items) {
      for (let i = 0; i < item.str.length; i++) {
        map.push({
          globalIndex: fullText.length + i,
          pageNumber: p.pageNumber,
          item,
          charIndex: i
        });
      }
    }
    fullText += p.text;
  }

  return { fullText, map };
}

// -----------------------------------------------
// Search across paragraphs/pages
// -----------------------------------------------
function findOccurrences(fullText, term) {
  const escaped = term.replace(/\s+/g, "\\s+");
  const re = new RegExp(escaped, "gi");

  const results = [];
  let m;
  while ((m = re.exec(fullText)) !== null) {
    results.push({ start: m.index, end: m.index + m[0].length });
  }
  return results;
}

// -----------------------------------------------
// Compute PDF rectangles
// -----------------------------------------------
function matchToRects(match, map) {
  const { start, end } = match;
  const slice = map.slice(start, end);

  const pages = new Map();
  for (const entry of slice) {
    if (!pages.has(entry.pageNumber)) {
      pages.set(entry.pageNumber, []);
    }
    pages.get(entry.pageNumber).push(entry);
  }

  const output = [];

  for (const [pageNumber, entries] of pages.entries()) {
    const groups = [];
    let current = [entries[0]];

    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const cur = entries[i];

      if (prev.item === cur.item && cur.charIndex === prev.charIndex + 1) {
        current.push(cur);
      } else {
        groups.push(current);
        current = [cur];
      }
    }
    groups.push(current);

    const rects = groups.map(g => {
      const item = g[0].item;
      const t = item.transform;
      return {
        x: t[4],
        y: t[5] + t[3],
        width: item.width,
        height: item.height
      };
    });

    output.push({ pageNumber, rects });
  }

  return output;
}

// -----------------------------------------------
// Worker message handler
// -----------------------------------------------
onmessage = async (event) => {
  const { pdfBuffer, searchTerm } = event.data;

  const pages = await extractPdf({ pdfBuffer });
  const { fullText, map } = buildMapping(pages);

  const matches = findOccurrences(fullText, searchTerm);

  const highlights = matches.map((m, idx) => ({
    id: `h-${idx}`,
    text: searchTerm,
    positions: matchToRects(m, map)
  }));

  postMessage({ highlights });
};
