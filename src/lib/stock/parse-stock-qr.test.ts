import { describe, expect, it } from "vitest";
import { parseStockQrCode } from "./parse-stock-qr";

describe("parseStockQrCode", () => {
  it("parses a real Sony display label (model, serial, 3 MACs, hw id)", () => {
    const raw = "FW-55BZ30L,2007890,80:99:E7:9D:A1:90,38:8D:3D:6C:FD:38,38:8D:3D:6C:FD:39,B0000B5B99FC";
    expect(parseStockQrCode(raw)).toEqual({
      model: "FW-55BZ30L",
      serialNo: "2007890",
      hwId: "B0000B5B99FC",
    });
  });

  it("takes the H/W ID from the last field regardless of how many MACs are in between", () => {
    expect(parseStockQrCode("MODEL-X,SN123,AA:BB:CC:DD:EE:FF,HWID999")).toEqual({
      model: "MODEL-X",
      serialNo: "SN123",
      hwId: "HWID999",
    });
    expect(parseStockQrCode("MODEL-X,SN123,HWID999")).toEqual({
      model: "MODEL-X",
      serialNo: "SN123",
      hwId: "HWID999",
    });
  });

  it("trims whitespace around each field", () => {
    expect(parseStockQrCode(" FW-55BZ30L , 2007890 , AA:BB , B0000B5B99FC ")).toEqual({
      model: "FW-55BZ30L",
      serialNo: "2007890",
      hwId: "B0000B5B99FC",
    });
  });

  it("returns null for a plain serial-number barcode (no commas) — falls back to today's scan-into-serial behaviour", () => {
    expect(parseStockQrCode("4006381333931")).toBeNull();
  });

  it("returns null for too few fields to be this format", () => {
    expect(parseStockQrCode("MODEL-X,SN123")).toBeNull();
    expect(parseStockQrCode("")).toBeNull();
  });
});
