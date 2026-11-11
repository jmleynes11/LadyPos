export const CLOTHING_SIZES = Object.freeze(["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
export const isClothing = category => typeof category === "string" && category.trim().toLowerCase() === "clothing";
export const supportsSizes = product => product.sizeStocks !== undefined || Array.isArray(product.sizes) || isClothing(product.category);
export const lineKey = (product, size) => size ? `${product}:${size}` : product;
export function cartLine(key, quantity) {
  const [product, size] = key.split(":");
  return { product, quantity, ...(size ? { size } : {}) };
}
