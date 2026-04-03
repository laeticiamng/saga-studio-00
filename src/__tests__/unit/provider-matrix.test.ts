import { describe, it, expect } from "vitest";
import { resolveProvider, getRenderTarget, isBrowserRenderAllowed, PROVIDER_MATRIX } from "@/config/providerMatrix";

describe("Provider Matrix — P0.2", () => {
  it("music_video premium blocks when no video provider available", () => {
    const result = resolveProvider("music_video", "premium", ["openai_image"]);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("Aucun provider");
  });

  it("music_video premium selects runway when available", () => {
    const result = resolveProvider("music_video", "premium", ["runway", "luma"]);
    expect(result.blocked).toBe(false);
    expect(result.selectedProvider).toBe("runway");
    expect(result.outputNature).toBe("native_video");
    expect(result.fallbackUsed).toBe(false);
  });

  it("music_video premium falls back to luma if runway down", () => {
    const result = resolveProvider("music_video", "premium", ["luma"]);
    expect(result.blocked).toBe(false);
    expect(result.selectedProvider).toBe("luma");
    expect(result.fallbackUsed).toBe(true);
  });

  it("music_video premium blocks with no providers", () => {
    const result = resolveProvider("music_video", "premium", []);
    expect(result.blocked).toBe(true);
  });

  it("music_video economy allows openai_image", () => {
    const result = resolveProvider("music_video", "economy", ["openai_image"]);
    expect(result.blocked).toBe(false);
    expect(result.selectedProvider).toBe("openai_image");
    expect(result.outputNature).toBe("image_sequence");
  });

  it("clip standard allows image sequence but flags fallback", () => {
    const result = resolveProvider("clip", "standard", ["openai_image"]);
    expect(result.blocked).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.outputNature).toBe("image_sequence");
  });

  it("getRenderTarget returns server_required for music_video premium", () => {
    expect(getRenderTarget("music_video", "premium")).toBe("server_required");
  });

  it("isBrowserRenderAllowed is false for premium", () => {
    expect(isBrowserRenderAllowed("music_video", "premium")).toBe(false);
    expect(isBrowserRenderAllowed("clip", "premium")).toBe(false);
  });

  it("isBrowserRenderAllowed is true for economy", () => {
    expect(isBrowserRenderAllowed("music_video", "economy")).toBe(true);
  });

  it("unknown mode/tier returns blocked", () => {
    const result = resolveProvider("unknown" as any, "premium", ["runway"]);
    expect(result.blocked).toBe(true);
  });

  it("decision log records all steps", () => {
    const result = resolveProvider("music_video", "premium", ["runway"]);
    expect(result.decisionLog.length).toBeGreaterThan(0);
    expect(result.decisionLog.some(l => l.includes("Selected"))).toBe(true);
  });
});
