import { describe, expect, it } from "vitest";
import { ProviderTokenCipher } from "./encryption";

const key = Buffer.alloc(32, 7).toString("base64");

describe("ProviderTokenCipher", () => {
  it("encrypts a provider token without preserving its plaintext and decrypts it only with the configured key", () => {
    const cipher = new ProviderTokenCipher(key, "v1");
    const encrypted = cipher.encrypt("provider-access-token");

    expect(encrypted.ciphertext).not.toContain("provider-access-token");
    expect(encrypted.keyVersion).toBe("v1");
    expect(cipher.decrypt(encrypted)).toBe("provider-access-token");
  });

  it("rejects ciphertext authentication failures", () => {
    const cipher = new ProviderTokenCipher(key, "v1");
    const encrypted = cipher.encrypt("provider-access-token");

    const alteredLastCharacter = encrypted.ciphertext.endsWith("A") ? "B" : "A";
    const tamperedCiphertext = `${encrypted.ciphertext.slice(0, -1)}${alteredLastCharacter}`;

    expect(() => cipher.decrypt({ ...encrypted, ciphertext: tamperedCiphertext })).toThrow();
  });
});
