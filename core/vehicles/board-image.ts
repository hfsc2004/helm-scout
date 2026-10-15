// SPDX-License-Identifier: Apache-2.0
/** Reject bootloader/merged/wrong-chip images before a user can upload them. */
export function isS3ApplicationImage(image: Uint8Array): boolean {
  if (image.length < 256 || image.length > 2097152 || image[0] !== 0xe9) return false;
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  return view.getUint32(32, true) === 0xabcd5432 && view.getUint16(12, true) === 9;
}
