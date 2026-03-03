const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function nanoid(length = 21): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}
