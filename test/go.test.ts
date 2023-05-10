import { describe, expect, test } from "vitest";
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

describe("refIndex", () => {
  test("strings", () => {
    expect(go("abc", ["hi abc", "def"])[0].refIndex).toEqual(0);
    expect(go("abc", ["a", "hi abc", "def"])[0].refIndex).toEqual(1);
    expect(go("abc", ["a", "hi abc"])[0].refIndex).toEqual(1);
  });

  test("objects", () => {
    expect(
      go("def", [{ id: "2", value: "def" }], {
        key: "value",
      })[0].refIndex
    ).toEqual(0);

    expect(
      go(
        "def",
        [
          { id: "1", value: "abc" },
          { id: "2", value: "def" },
        ],
        {
          key: "value",
        }
      )[0].refIndex
    ).toEqual(1);

    expect(
      go("def", [{ id: "1", value: "abc" }, {}, { id: "2", value: "def" }], {
        key: "value",
      })[0].refIndex
    ).toEqual(2);
  });

  test("nested keys", () => {
    expect(
      go(
        "def",
        [
          { id: "1", topic: { name: "abc" } },
          { id: "2", topic: { name: "def" } },
        ],
        { key: "topic.name" }
      )[0].refIndex
    ).toEqual(1);
  });
});
