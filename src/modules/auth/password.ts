import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, memory-hard). The cost
 * parameters are stored with each hash, so they can be raised later without
 * invalidating existing passwords.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 };
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, N: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { N, r, p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS.N, PARAMS.r, PARAMS.p, PARAMS.keyLength);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(N), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

/**
 * A real hash of a password nobody has. Verifying against it when an email is
 * unknown makes "no such account" take as long as "wrong password".
 */
let decoy: Promise<string> | undefined;
export function decoyHash(): Promise<string> {
  return (decoy ??= hashPassword(randomBytes(24).toString("hex")));
}
