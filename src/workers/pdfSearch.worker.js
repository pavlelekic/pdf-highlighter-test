import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Set the worker source - the warning is expected when using PDF.js inside a worker
// It will use a "fake worker" (synchronous) which is fine for our use case
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

// --------------------------------------------------
// Extract text + mapping
// --------------------------------------------------
async function extractPages(buffer) {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: buffer,
    }).promise;
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
  } catch (error) {
    console.error("Error extracting pages:", error);
    throw error;
  }
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
  try {
    const { pdfBuffer, searchTerm } = e.data;
    console.log("Worker received search request for:", searchTerm);

    const pages = await extractPages(pdfBuffer);
    console.log("Pages extracted:", pages.length);

    const { fullText, map } = buildCharMap(pages);
    console.log("Character map built, total chars:", fullText.length);

    const occurrences = findOccurrences(fullText, searchTerm);
    console.log("Occurrences found:", occurrences.length);

    const highlights = occurrences.map((occ, i) => ({
      id: `h-${i}`,
      text: searchTerm,
      positions: matchToRects(occ, map),
    }));

    console.log("Highlights created:", highlights.length);
    postMessage({ highlights });
  } catch (error) {
    console.error("Worker error:", error);
    postMessage({ highlights: [], error: error.message });
  }
};
