import PdfSearchWorker from "../workers/pdfSearch.worker?worker";

export function searchPdf(pdfBuffer, searchTerm) {
  return new Promise((resolve) => {
    const worker = new PdfSearchWorker();

    worker.postMessage({ pdfBuffer, searchTerm });

    worker.onmessage = (e) => {
      resolve(e.data.highlights);
      worker.terminate();
    };
  });
}
