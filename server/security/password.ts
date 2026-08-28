import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const scryptCost = 16_384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, keyLength, { N: scryptCost });
  return `scrypt$${scryptCost}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, costText, saltText, hashText] = storedHash.split("$");
  if (algorithm !== "scrypt" || !costText || !saltText || !hashText) {
    return false;
  }

  const cost = Number(costText);
  if (!Number.isSafeInteger(cost) || cost < scryptCost) {
    return false;
  }

  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = scryptSync(password, Buffer.from(saltText, "base64url"), expected.length, { N: cost });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
