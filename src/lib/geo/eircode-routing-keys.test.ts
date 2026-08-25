import { describe, expect, it } from "vitest";
import { centroidForRoutingKey } from "./eircode-routing-keys";

describe("centroidForRoutingKey", () => {
  it("resolves a known routing key regardless of case or spacing", () => {
    expect(centroidForRoutingKey("D22 XH22")).toEqual({ latitude: 53.3225, longitude: -6.3939 });
    expect(centroidForRoutingKey("d22xh22")).toEqual({ latitude: 53.3225, longitude: -6.3939 });
  });

  it("resolves a routing key with a letter in the third position", () => {
    expect(centroidForRoutingKey("D6W ABCD")).toEqual({ latitude: 53.3096, longitude: -6.2825 });
  });

  it("returns null for a well-formed but unrecognised routing key", () => {
    expect(centroidForRoutingKey("Z99 XH22")).toBeNull();
  });

  it("returns null for input that doesn't structurally look like a routing key", () => {
    expect(centroidForRoutingKey("NOT A POSTCODE")).toBeNull();
    expect(centroidForRoutingKey("")).toBeNull();
  });
});
