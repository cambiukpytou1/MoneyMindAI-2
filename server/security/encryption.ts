import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedProviderToken = {
  keyVersion: string;
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
};

export class ProviderTokenCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string, private readonly keyVersion: string) {
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
    }
    if (!keyVersion) {
      throw new Error("Encryption key version is required");
    }
  }

  encrypt(plaintext: string): EncryptedProviderToken {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    return {
      keyVersion: this.keyVersion,
      ciphertext: ciphertext.toString("base64url"),
      initializationVector: initializationVector.toString("base64url"),
      authenticationTag: cipher.getAuthTag().toString("base64url"),
    };
  }

  decrypt(encrypted: EncryptedProviderToken): string {
    if (encrypted.keyVersion !== this.keyVersion) {
      throw new Error("Ciphertext key version is not supported by the active cipher");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(encrypted.initializationVector, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authenticationTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}
