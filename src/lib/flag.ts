/** A country's flag emoji from its ISO code ("TR" → 🇹🇷); empty for anything else. */
export function flag(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...[...country].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}
