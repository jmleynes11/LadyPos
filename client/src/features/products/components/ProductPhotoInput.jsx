import { useRef, useState } from "react";

export default function ProductPhotoInput({ value, onChange, disabled, onBusyChange }) {
  const [error, setError] = useState("");
  const generation = useRef(0);
  async function select(event) {
    const file = event.target.files?.[0], current = ++generation.current;
    setError(""); onChange("");
    if (!file) return;
    onBusyChange(true);
    let bitmap;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) throw new Error("Select a PNG, JPEG or WebP image up to 2 MB.");
      bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 25000000) throw new Error("Image dimensions are too large. Select an image under 25 megapixels.");
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const limit = Math.ceil(512 * 1024 / 3) * 4 + 22;
      let photo = canvas.toDataURL("image/png");
      while (photo.length > limit && Math.max(canvas.width, canvas.height) > 200) {
        canvas.width = Math.max(1, Math.round(canvas.width * 0.75)); canvas.height = Math.max(1, Math.round(canvas.height * 0.75));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        photo = canvas.toDataURL("image/png");
      }
      if (photo.length > limit) throw new Error("Processed photo exceeds 512 KB. Select a smaller image.");
      if (current === generation.current) onChange(photo);
    } catch (err) {
      if (current === generation.current) { setError(err.message || "Unable to read this image. Select another file."); event.target.value = ""; }
    } finally { bitmap?.close(); event.target.value = ""; if (current === generation.current) onBusyChange(false); }
  }
  return <div className="form-stack"><label>Product photo (optional)<input className="input min-h-11" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={select} /></label><p className="helper-text">PNG, JPEG or WebP, up to 2 MB. Photos are resized for storage.</p>{error && <p role="alert">{error}</p>}{value && <div><img src={value} alt="Selected product photo" style={{ width: 120, height: 120, objectFit: "contain" }} /><button className="secondary-action" type="button" disabled={disabled} onClick={() => { generation.current++; onChange(""); }}>Remove photo</button></div>}</div>;
}
