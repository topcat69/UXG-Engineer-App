/**
 * The label QR on a lot of commercial AV kit — confirmed against a real
 * Sony display's own label — encodes "MODEL,SERIAL,MAC,MAC,MAC,HW_ID"
 * (comma-separated). Model is always first, serial always second, H/W ID
 * always last; the MAC count in between varies by model (some units have
 * fewer/more network interfaces), so this reads position from both ends
 * rather than assuming exactly 6 fields.
 */
export type ParsedStockQr = { model: string; serialNo: string; hwId: string };

export function parseStockQrCode(raw: string): ParsedStockQr | null {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // Model + serial + at least one more field (the H/W ID) — anything
  // shorter isn't this format, most likely a plain serial-number barcode
  // scanned on the same button.
  if (parts.length < 3) return null;

  const model = parts[0]!;
  const serialNo = parts[1]!;
  const hwId = parts[parts.length - 1]!;
  return { model, serialNo, hwId };
}
