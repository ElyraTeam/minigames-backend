import { describe, it, expect } from "vitest";
import { findMajority } from "../utils/utils.js";

describe("findMajority", () => {
  describe("basic behavior (no totalVotes)", () => {
    it("returns null for an empty array", () => {
      expect(findMajority([])).toBeNull();
    });

    it("returns the single element for a 1-element array", () => {
      expect(findMajority([10])).toBe(10);
    });

    it("returns the majority when one value dominates", () => {
      expect(findMajority([10, 10, 10, 5, 5])).toBe(10);
    });

    it("returns null when there is no majority", () => {
      // 3 distinct values, none > 50%
      expect(findMajority([10, 5, 0])).toBeNull();
    });

    it("returns null for evenly split votes", () => {
      expect(findMajority([10, 5, 10, 5])).toBeNull();
    });

    it("returns the value when all votes are the same", () => {
      expect(findMajority([5, 5, 5])).toBe(5);
    });

    it("handles a tie at exactly half (not strict majority)", () => {
      // 2 out of 4 = 50%, not > 50%
      expect(findMajority([10, 10, 5, 5])).toBeNull();
    });

    it("returns majority for value with just over half", () => {
      // 3 out of 5 = 60% > 50%
      expect(findMajority([10, 10, 10, 5, 0])).toBe(10);
    });
  });

  describe("with totalVotes parameter", () => {
    it("returns the majority when votes exceed half of totalVotes", () => {
      // 3 votes of 10 out of 5 total voters → 3/5 = 60% > 50%
      expect(findMajority([10, 10, 10], 5)).toBe(10);
    });

    it("returns null when votes don't exceed half of totalVotes", () => {
      // 2 votes of 10 out of 5 total voters → 2/5 = 40% ≤ 50%
      expect(findMajority([10, 10], 5)).toBeNull();
    });

    it("returns null when exactly half of totalVotes (not strict majority)", () => {
      // 2 votes of 10 out of 4 total → 2/4 = 50%, not > 50%
      expect(findMajority([10, 10], 4)).toBeNull();
    });

    it("returns majority for 1 vote out of 1 totalVotes", () => {
      expect(findMajority([10], 1)).toBe(10);
    });

    it("returns null when no value dominates even against totalVotes", () => {
      // 1 vote for 10, 1 vote for 5, totalVotes = 3
      expect(findMajority([10, 5], 3)).toBeNull();
    });

    it("works correctly with 0 as a vote value", () => {
      // 3 votes of 0 out of 4 total → 3/4 = 75% > 50%
      expect(findMajority([0, 0, 0], 4)).toBe(0);
    });

    it("handles large totalVotes where partial votes can't form majority", () => {
      // 2 votes of 10 out of 10 total → only 20%
      expect(findMajority([10, 10], 10)).toBeNull();
    });
  });

  describe("game-specific vote values (0, 5, 10)", () => {
    it("returns 10 when most voters agree the answer is correct", () => {
      expect(findMajority([10, 10, 10, 0, 5], 4)).toBe(10);
    });

    it("returns 0 when most voters agree the answer is wrong", () => {
      expect(findMajority([0, 0, 0, 10], 4)).toBe(0);
    });

    it("returns 5 when most voters agree the answer is duplicated", () => {
      expect(findMajority([5, 5, 5, 10], 4)).toBe(5);
    });

    it("returns null when voters are split three ways", () => {
      expect(findMajority([0, 5, 10], 4)).toBeNull();
    });
  });
});
