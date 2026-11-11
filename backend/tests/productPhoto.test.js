import test from "node:test";
import assert from "node:assert/strict";
import { validateProductPhoto } from "../utils/productPhoto.js";
import { photoFixture } from "./productPhotoFixture.js";

test("product photo validates PNG contents, dimensions, size and decompression", () => {
  const photo = photoFixture(); assert.equal(validateProductPhoto(photo), photo);
  for (const value of [null, {}, "", "https://example.com/photo.png", "data:image/svg+xml;base64,PHN2Zy8+", photo.slice(0, -8), photo.replace("iVBOR", "jVBOR"), `data:image/png;base64,${"A".repeat(710000)}`, photoFixture({ width: 1025 }), photoFixture({ raw: Buffer.from([0]) }), photoFixture({ raw: Buffer.from([5, 0, 0, 0, 0]) }), photoFixture({ raw: Buffer.alloc(100000) })]) {
    assert.throws(() => validateProductPhoto(value), error => error.statusCode === 400);
  }
});
