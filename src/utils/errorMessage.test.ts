import { describe, expect, it } from "vitest";
import { isExternalUrl } from "./externalUrl";
import { toErrorMessage } from "./errorMessage";
import { mapPool } from "./mapPool";

describe("isExternalUrl", () => {
  it("accepts http/https urls", () => {
    expect(isExternalUrl("https://example.com")).toBe(true);
    expect(isExternalUrl("http://example.com/a")).toBe(true);
    expect(isExternalUrl("[https://bgm.tv/subject/1 标签]")).toBe(true);
  });

  it("rejects non-http schemes", () => {
    expect(isExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isExternalUrl("file:///tmp/a")).toBe(false);
    expect(isExternalUrl("not a url")).toBe(false);
  });
});

describe("toErrorMessage", () => {
  it("reads string and Error", () => {
    expect(toErrorMessage("boom")).toBe("boom");
    expect(toErrorMessage(new Error("x"), "fallback")).toBe("x");
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("mapPool", () => {
  it("maps with concurrency", async () => {
    const result = await mapPool([1, 2, 3, 4], 2, async (n) => n * 2);
    expect(result).toEqual([2, 4, 6, 8]);
  });
});
