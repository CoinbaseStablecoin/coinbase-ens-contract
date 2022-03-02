import { expect } from "chai";
import { encode } from "../src/dnsname";

describe("dnsname", () => {
  describe("encode", () => {
    it("encodes a given name in the ens-compatible dns wire format", () => {
      ["test.eth", ".test.eth", "test.eth.", "..test.eth..."].forEach((name) =>
        expect(encode(name).toString("hex")).to.equal("04746573740365746800")
      );
      [
        ["pete.test.eth", "047065746504746573740365746800"],
        ["this.is.test.eth", "047468697302697304746573740365746800"],
        ["example.xyz", "076578616d706c650378797a00"],
        ["", "0000"],
      ].forEach((tc) => expect(encode(tc[0]).toString("hex")).to.equal(tc[1]));
    });

    it("throws an error if a label has greater than 63 characters", () => {
      expect(() =>
        encode(
          "0000000001000000000200000000030000000004000000000500000000061234.eth"
        )
      ).to.throw("label too long");
    });
  });
});
