import { inflateSync } from "node:zlib";

export const MAX_PHOTO_BYTES = 512 * 1024;
const invalid = () => { const error = new Error("Invalid product photo. Select a PNG, JPEG or WebP image up to 2 MB."); error.statusCode = 400; throw error; };
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

// The browser normalizes uploads to bounded PNGs. Store the validated bytes
// atomically with the product; no public filesystem or orphan upload is needed.
export function validateProductPhoto(value) {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 22 || !/^data:image\/png;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) invalid();
  const bytes = Buffer.from(value.slice(22), "base64");
  if (bytes.length > MAX_PHOTO_BYTES || bytes.length < 57 || bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") invalid();
  let offset = 8, width, height, channels, ended = false, sawData = false, dataEnded = false;
  const data = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) invalid();
    const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
    if (end > bytes.length) invalid();
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid();
    if (offset === 8) {
      if (type !== "IHDR" || size !== 13) invalid();
      width = bytes.readUInt32BE(offset + 8); height = bytes.readUInt32BE(offset + 12);
      const color = bytes[offset + 17];
      channels = color === 6 ? 4 : color === 2 ? 3 : 0;
      if (!width || !height || width > 1024 || height > 1024 || !channels || bytes[offset + 16] !== 8 || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20]) invalid();
    } else if (type === "IDAT") {
      if (dataEnded) invalid();
      sawData = true; data.push(bytes.subarray(offset + 8, end - 4));
    } else if (type === "IEND") {
      if (size || !sawData || end !== bytes.length) invalid();
      ended = true;
    } else {
      if (sawData) dataEnded = true;
      // Reject active metadata, unknown chunks and duplicate headers.
      if (!["sRGB", "gAMA", "cHRM", "pHYs"].includes(type)) invalid();
    }
    offset = end;
  }
  if (!ended) invalid();
  try {
    const stride = width * channels + 1, expected = stride * height;
    const pixels = inflateSync(Buffer.concat(data), { maxOutputLength: expected });
    if (pixels.length !== expected) invalid();
    for (let row = 0; row < height; row++) if (pixels[row * stride] > 4) invalid();
  } catch { invalid(); }
  return value;
}
