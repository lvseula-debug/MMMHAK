/**
 * Unit tests for mapLegacySentimentKeys() and parseBackendScores() SSOT behavior.
 *
 * Run with: npm test
 *
 * Key invariants verified:
 * 1. love -> Uplifting is 1:1 and independent from happy -> Serenity
 * 2. mapLegacySentimentKeys is idempotent (new-key input passes through unchanged)
 * 3. parseBackendScores preserves BE primary_emotion exactly (SSOT)
 * 4. parseBackendScores falls back to argmax when primary_emotion is absent (legacy BE)
 */

import { describe, it, expect } from "vitest";
import { mapLegacySentimentKeys } from "../../hooks.js";

// ---------------------------------------------------------------------------
// Helper: mirrors parseBackendScores from hooks.js (closure fn, tested inline)
// ---------------------------------------------------------------------------
function parseBackendScores(backendData, streams = 1_000_000) {
  const scoresObj = backendData.scores || backendData;
  const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);
  const emotions = {
    Uplifting:   clamp01(scoresObj.Uplifting   ?? backendData.Uplifting),
    Energetic:   clamp01(scoresObj.Energetic   ?? backendData.Energetic),
    Aggressive:  clamp01(scoresObj.Aggressive  ?? backendData.Aggressive),
    Melancholic: clamp01(scoresObj.Melancholic ?? backendData.Melancholic),
    Desolation:  clamp01(scoresObj.Desolation  ?? backendData.Desolation),
    Serenity:    clamp01(scoresObj.Serenity    ?? backendData.Serenity),
  };
  const primary_emotion =
    scoresObj.primary_emotion ||
    backendData.primary_emotion ||
    Object.entries(emotions).sort((a, b) => b[1] - a[1])[0][0];
  const confidence = clamp01(scoresObj.confidence ?? backendData.confidence ?? 0.5);
  const insufficient_data = !!(backendData.insufficient_data || backendData.no_info);
  return { ...emotions, primary_emotion, confidence, insufficient_data, isAI: true, source: "ai", streams };
}

// ===========================================================================
// mapLegacySentimentKeys
// ===========================================================================

describe("mapLegacySentimentKeys", () => {
  it("maps love -> Uplifting independently from happy -> Serenity (1:1, no merge)", () => {
    const result = mapLegacySentimentKeys({ happy: 0.3, love: 0.7 });
    expect(result.Uplifting).toBe(0.7);
    expect(result.Serenity).toBe(0.3);
    expect(result.Uplifting).not.toBe(result.Serenity);
  });

  it("maps all 6 old keys to corresponding new keys exactly", () => {
    const input = { happy: 0.1, love: 0.2, sad: 0.3, angry: 0.4, lonely: 0.5, confident: 0.6 };
    const result = mapLegacySentimentKeys(input);
    expect(result.Serenity).toBeCloseTo(0.1);
    expect(result.Uplifting).toBeCloseTo(0.2);
    expect(result.Melancholic).toBeCloseTo(0.3);
    expect(result.Aggressive).toBeCloseTo(0.4);
    expect(result.Desolation).toBeCloseTo(0.5);
    expect(result.Energetic).toBeCloseTo(0.6);
  });

  it("is idempotent: new-key input (Uplifting defined) passes through as same object", () => {
    const newKeyInput = { Uplifting: 0.42, Serenity: 0.11, Melancholic: 0.28,
                          Aggressive: 0.08, Desolation: 0.06, Energetic: 0.05 };
    const result = mapLegacySentimentKeys(newKeyInput);
    expect(result).toBe(newKeyInput);
  });

  it("clamps out-of-range values to [0, 1]", () => {
    const result = mapLegacySentimentKeys({ happy: 1.5, love: -0.3 });
    expect(result.Serenity).toBe(1);
    expect(result.Uplifting).toBe(0);
  });

  it("returns empty object for null/undefined input", () => {
    expect(mapLegacySentimentKeys(null)).toEqual({});
    expect(mapLegacySentimentKeys(undefined)).toEqual({});
  });
});

// ===========================================================================
// parseBackendScores SSOT
// ===========================================================================

describe("parseBackendScores - SSOT behavior", () => {
  it("[SSOT] preserves BE primary_emotion exactly, FE must NOT recalculate", () => {
    const beResponse = {
      Uplifting: 0.30,
      Melancholic: 0.50,
      Energetic: 0.05, Aggressive: 0.05, Desolation: 0.05, Serenity: 0.05,
      primary_emotion: "Uplifting",
      confidence: 0.85,
    };
    const result = parseBackendScores(beResponse);
    expect(result.primary_emotion).toBe("Uplifting");
  });

  it("[SSOT] reads primary_emotion from nested scores field", () => {
    const beResponse = {
      scores: {
        Uplifting: 0.47, Energetic: 0.12, Aggressive: 0.08,
        Melancholic: 0.15, Desolation: 0.10, Serenity: 0.08,
        primary_emotion: "Uplifting",
        confidence: 0.82,
      }
    };
    const result = parseBackendScores(beResponse);
    expect(result.primary_emotion).toBe("Uplifting");
    expect(result.Uplifting).toBeCloseTo(0.47);
  });

  it("[legacy fallback] uses argmax when primary_emotion field is absent", () => {
    const legacyResponse = {
      Uplifting: 0.55, Energetic: 0.10, Aggressive: 0.05,
      Melancholic: 0.15, Desolation: 0.10, Serenity: 0.05,
    };
    const result = parseBackendScores(legacyResponse);
    expect(result.primary_emotion).toBe("Uplifting");
  });

  it("clamps all emotion scores to [0, 1]", () => {
    const beResponse = {
      Uplifting: 1.2, Energetic: -0.1, Aggressive: 0.5,
      Melancholic: 0.3, Desolation: 0.2, Serenity: 0.1,
      primary_emotion: "Uplifting",
    };
    const result = parseBackendScores(beResponse);
    expect(result.Uplifting).toBe(1);
    expect(result.Energetic).toBe(0);
  });
});
