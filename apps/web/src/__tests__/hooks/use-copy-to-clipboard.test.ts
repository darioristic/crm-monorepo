import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "../../hooks/use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  it("should initialize with null copied text", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const [copiedText] = result.current;

    expect(copiedText).toBeNull();
  });

  it("should copy text to clipboard and return true", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    const testText = "Hello, World!";
    let success = false;

    await act(async () => {
      const [, copy] = result.current;
      success = await copy(testText);
    });

    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testText);

    // Check that copiedText was updated
    const [copiedText] = result.current;
    expect(copiedText).toBe(testText);
  });

  it("should handle clipboard errors gracefully", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.reject(new Error("Clipboard error"))),
      },
    });

    const { result } = renderHook(() => useCopyToClipboard());
    let success = true;

    await act(async () => {
      const [, copy] = result.current;
      success = await copy("test");
    });

    expect(success).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith("Copy failed", expect.any(Error));

    const [copiedText] = result.current;
    expect(copiedText).toBeNull();

    consoleWarnSpy.mockRestore();
  });

  it("should handle missing clipboard API", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Remove clipboard API
    Object.assign(navigator, {
      clipboard: undefined,
    });

    const { result } = renderHook(() => useCopyToClipboard());
    let success = true;

    await act(async () => {
      const [, copy] = result.current;
      success = await copy("test");
    });

    expect(success).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith("Clipboard not supported");

    consoleWarnSpy.mockRestore();
  });

  it("should allow copying different texts sequentially", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      const [, copy] = result.current;
      await copy("first");
    });

    let [copiedText] = result.current;
    expect(copiedText).toBe("first");

    await act(async () => {
      const [, copy] = result.current;
      await copy("second");
    });

    [copiedText] = result.current;
    expect(copiedText).toBe("second");
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
  });
});
