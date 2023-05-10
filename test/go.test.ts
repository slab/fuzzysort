import { expect, test } from "vitest";
import { go } from "../src/fuzzysort";
import { urlsAndTitles } from "./__fixtures__/data";

test("strings", () => {
  expect(Math.sqrt(4)).toBe(2);
  expect(go("a", ["ab", "bc"])).toHaveLength(1);

  const results = go("zom", urlsAndTitles);
  expect(results[0].target).toEqual("jQuery Zoom");
});

test("sorting", () => {
  const testSorting = (search: string, ...targets: string[]) => {
    expect(go(search, targets)[0].target).toEqual(targets[0]);
  };

  testSorting("adio", "Audio.h", "AsyncTaskDownloadImage.h");
  testSorting("note", "node/noTe", "not one that evening");

  // https://github.com/home-assistant/frontend/discussions/12590#discussioncomment-2694018
  testSorting(
    "er.life360",
    "device-tracker.life360_iphone_6",
    "sendor.battery_life360_iphone_6"
  );

  // order should matter when using spaces
  testSorting("c man", "CheatManager.h", "ManageCheats.h");
  testSorting("man c", "ManageCheats.h", "CheatManager.h");

  testSorting("man c", "ThisManagesStuff.c", "ThisCheatsStuff.m");
  testSorting("c man", "ThisCheatsStuff.man", "ThisManagesStuff.c");
});
