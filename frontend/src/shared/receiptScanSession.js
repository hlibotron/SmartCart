import { apiUrl } from "./api.js";
import { authHeaders } from "./authSession.js";

let receiptScanState = {
  status: "idle",
  error: "",
  fileName: "",
  receiptId: null,
  promise: null,
};

function setReceiptScanState(nextState) {
  receiptScanState = {
    ...receiptScanState,
    ...nextState,
  };
  window.dispatchEvent(new CustomEvent("receipt-scan-statechange", { detail: receiptScanState }));
}

export function getReceiptScanState() {
  return receiptScanState;
}

export function isReceiptScanLocked() {
  return receiptScanState.status === "processing";
}

export function clearReceiptScanSession() {
  setReceiptScanState({
    status: "idle",
    error: "",
    fileName: "",
    receiptId: null,
    promise: null,
  });
}

export function startReceiptScan(file) {
  if (receiptScanState.status === "processing" && receiptScanState.promise) {
    return receiptScanState.promise;
  }

  const formData = new FormData();
  formData.append("image", file);

  const promise = fetch(apiUrl("/api/receipt-scans/upload"), {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  })
    .then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || `Помилка сканування: ${response.status}`);
      }

      const receiptId = data?.receipt_id;
      if (!receiptId) {
        throw new Error("Сервер не повернув ID чеку");
      }

      setReceiptScanState({
        status: "done",
        receiptId,
        error: "",
        promise: null,
      });
      return data;
    })
    .catch((error) => {
      setReceiptScanState({
        status: "error",
        error: error.message || "Не вдалося розпізнати чек",
        promise: null,
      });
      throw error;
    });

  setReceiptScanState({
    status: "processing",
    error: "",
    fileName: file?.name || "Фото чеку",
    receiptId: null,
    promise,
  });

  return promise;
}
