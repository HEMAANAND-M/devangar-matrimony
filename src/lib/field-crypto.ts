import "server-only";
import { usingDerivedKey } from "./field-crypto-core";

export * from "./field-crypto-core";

if (process.env.NODE_ENV === "production" && usingDerivedKey()) {
  console.warn("[field-crypto] DATA_ENCRYPTION_KEY is not set; contact details are encrypted with a key derived from SESSION_SECRET. Set a dedicated key before launch.");
}
