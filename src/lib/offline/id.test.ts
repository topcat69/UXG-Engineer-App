import { afterEach, describe, expect, it, vi } from "vitest";
import { generateId } from "./id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID() when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid-from-randomuuid" });
    expect(generateId()).toBe("fixed-uuid-from-randomuuid");
  });

  it("falls back to a getRandomValues-built v4 UUID when randomUUID is missing (e.g. plain HTTP)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        arr.fill(0xab);
        return arr;
      },
    });
    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it("falls back to Math.random() when Web Crypto is entirely unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    const id = generateId();
    expect(id).toMatch(UUID_V4_RE);
  });
});
