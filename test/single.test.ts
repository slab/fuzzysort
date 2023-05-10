import { expect, test } from "vitest";
import { single } from "../src/fuzzysort";

test("exponential backtracking", () => {
  const start = performance.now();
  const target =
    "a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a xb";
  const result = single("aaaaaaaaaaab", target);
  expect(performance.now() - start).toBeLessThan(16);
  expect(result).toHaveProperty("target", target);
});

// https://github.com/farzher/fuzzysort/issues/99
test("space should not destroy score", () => {
  expect(
    single(
      "this is exactly the same search and target",
      "this is exactly the same search and target"
    )
  ).toHaveProperty("score", 0);
});

test("no match", () => {
  const testNomatch = (target: string, ...searches: string[]) => {
    for (const search of searches) {
      const result = single(search, target);
      expect(result).toBeNull();
    }
  };

  // Typos
  testNomatch("abc", "acb");
  testNomatch("abcefg", "acbefg");
  testNomatch("a ac acb", "abc");
  testNomatch("MeshRendering.h", "mrnederh");
  testNomatch("AndroidRuntimeSettings.h", "nothing");
  testNomatch("atsta", "atast");

  // checking for infinite loops
  testNomatch("a", "");
  testNomatch("", "a");
  testNomatch("", "");
  testNomatch("", " ");
  testNomatch(" ", "");
});
