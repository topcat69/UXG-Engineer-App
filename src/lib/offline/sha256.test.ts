import { describe, expect, it } from "vitest";
import { bytesToHex, sha256Bytes } from "./sha256";

function hash(text: string): string {
  return bytesToHex(sha256Bytes(new TextEncoder().encode(text)));
}

describe("sha256Bytes", () => {
  // Standard FIPS 180-4 test vectors, cross-checked against Node's own
  // crypto.createHash("sha256") rather than transcribed from memory.
  it("hashes the empty string", () => {
    expect(hash("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("hashes 'abc'", () => {
    expect(hash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes a message spanning multiple 512-bit blocks", () => {
    expect(hash("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("hashes a message requiring the 64-bit length field's low word to be exact", () => {
    // 64 'a's — exercises the block-boundary padding path (message length
    // exactly a multiple of 64 bytes before the 0x80 padding byte).
    expect(hash("a".repeat(64))).toBe("ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");
  });
});
