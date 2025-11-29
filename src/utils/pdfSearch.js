import PdfSearchWorker from "../workers/pdfSearch.worker?worker";

export function searchPdf(pdfBuffer, searchTerm) {
  return new Promise((resolve, reject) => {
    const worker = new PdfSearchWorker();

    // Set a timeout in case the worker doesn't respond
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Worker timeout"));
    }, 30000); // 30 second timeout

    worker.postMessage({ pdfBuffer, searchTerm });

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      console.log("Worker response:", e.data);
      resolve(e.data.highlights);
      worker.terminate();
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      console.error("Worker error:", error);
      reject(error);
      worker.terminate();
    };
  });
}
