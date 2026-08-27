import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats minor-unit USD amounts without floating-point drift", () => {
    expect(formatMoney(123_456, "USD")).toBe("$1,234.56");
  });

  it("formats a negative amount with the sign before the currency symbol", () => {
    expect(formatMoney(-2_500, "USD")).toBe("-$25.00");
  });
});
