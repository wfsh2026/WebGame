export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const parts = Array.from(bytes, byte => {
    const hex = byte.toString(16);
    return hex.padStart(2, '0');
  });
  return parts.join('');
}

export function newRequestUuid(): string {
  const id = newRequestId();
  const parts = [id.slice(0, 8), id.slice(8, 12), id.slice(12, 16), id.slice(16, 20), id.slice(20)];
  return parts.join('-');
}
