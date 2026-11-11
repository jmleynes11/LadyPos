import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

async function component(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  const compiled = await transformWithOxc(source, "Photo.jsx", { jsx: { runtime: "automatic", development: false } });
  const code = compiled.code.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime"))).replaceAll('"react"', JSON.stringify(import.meta.resolve("react")));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { ProductVisual, ProductDetails } = await component("../src/shared/components/BookstoreUI.jsx");
const { default: ProductPhotoInput } = await component("../src/features/products/components/ProductPhotoInput.jsx");
const imageUrl = "data:image/png;base64,iVBORw0KGgo=";

test("existing catalog visual and product details render stored photos and preserve missing-photo fallback", () => {
  const product = { name: "Photo book", category: "Books", imageUrl, availability: true };
  for (const View of [ProductVisual, ProductDetails]) {
    const html = renderToStaticMarkup(createElement(View, { product, price: "PHP 10.00", onClose() {} }));
    assert(html.includes(`src="${imageUrl}"`)); assert(html.includes('alt="Photo book"'));
    assert(!html.includes("Product photography and additional descriptions are currently unavailable"));
  }
  assert(renderToStaticMarkup(createElement(ProductVisual, { product: { name: "Legacy book" } })).includes("No product photo"));
});

test("photo selector displays preview, permitted types, limits and disabled state", () => {
  const html = renderToStaticMarkup(createElement(ProductPhotoInput, { value: imageUrl, disabled: true, onChange() {}, onBusyChange() {} }));
  for (const text of ['type="file"', 'accept="image/png,image/jpeg,image/webp"', 'alt="Selected product photo"', "Remove photo", "up to 2 MB", "disabled"]) assert(html.includes(text));
});
