export const CLOTHING_SIZES = Object.freeze(["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
export const isClothing = category => typeof category === "string" && category.trim().toLowerCase() === "clothing";
// Existing variant configuration survives display-name/category edits. The name
// remains a fallback for legacy garments that still need explicit allocation.
export const supportsSizes = product => product.sizeStocks !== undefined || isClothing(product.category);

export function validSizeStocks(value) {
  return Boolean(value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length > 0 && Object.entries(value).every(([size, stock]) =>
      CLOTHING_SIZES.includes(size) && Number.isSafeInteger(stock) && stock >= 0) &&
    Number.isSafeInteger(Object.values(value).reduce((sum, stock) => sum + stock, 0)));
}

export const sizeStockTotal = sizes => Object.values(sizes).reduce((sum, stock) => sum + stock, 0);
export const clothingAvailable = product => !supportsSizes(product) ? product.stock > 0 :
  validSizeStocks(product.sizeStocks) && sizeStockTotal(product.sizeStocks) === product.stock && product.stock > 0;

export function sizeOptions(product) {
  if (!supportsSizes(product)) return {};
  return { sizes: CLOTHING_SIZES.filter(size => Object.hasOwn(product.sizeStocks || {}, size))
    .map(size => ({ size, available: product.sizeStocks[size] > 0 })) };
}
