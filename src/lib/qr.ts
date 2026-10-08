import QRCode from "qrcode";

const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#0b1220", light: "#ffffff" } };

export async function qrPngDataUrl(text: string, width = 1024) {
  return QRCode.toDataURL(text, { ...opts, width });
}
export async function qrSvg(text: string) {
  return QRCode.toString(text, { ...opts, type: "svg" });
}
export function downloadFile(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
