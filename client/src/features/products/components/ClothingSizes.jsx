import { CLOTHING_SIZES, isClothing, supportsSizes } from "../clothingSizes.js";

export function ClothingSizeFields({ category, value = {}, onChange, disabled, stockDisabled = false, sized = false }) {
  if (!sized && !isClothing(category)) return null;
  return <fieldset disabled={disabled} className="form-stack"><legend>Size Selection</legend>
    <p className="helper-text">Select available clothing sizes and enter the stock quantity for each size.</p>
    <div className="grid gap-3 md:grid-cols-2">{CLOTHING_SIZES.map(size => {
      const selected = Object.hasOwn(value, size);
      return <div key={size}><label className="checkbox-row"><input type="checkbox" checked={selected} onChange={event => {
        const next = { ...value };
        if (event.target.checked) next[size] = 0; else delete next[size];
        onChange(next);
      }} />{size}</label>{selected && <label>{size} stock quantity<input className="input min-h-11" type="number" min="0" step="1" required disabled={stockDisabled} value={value[size]} onChange={event => onChange({ ...value, [size]: event.target.value === "" ? "" : Number(event.target.value) })} /></label>}</div>;
    })}</div>
  </fieldset>;
}

export function ClothingSizeSelect({ product, value, onChange, disabled, inventory = false }) {
  if (!supportsSizes(product)) return null;
  const options = inventory ? CLOTHING_SIZES.filter(size => Object.hasOwn(product.sizeStocks || {}, size)).map(size => ({ size, available: true })) : product.sizes || [];
  return <label>Size<select className="input min-h-11" required disabled={disabled} value={value || ""} onChange={event => onChange(event.target.value)}><option value="">Select size</option>{options.map(option => <option key={option.size} value={option.size} disabled={!option.available}>{option.size}{inventory ? ` · ${product.sizeStocks[option.size]} units` : option.available ? "" : " · Out of stock"}</option>)}</select></label>;
}
