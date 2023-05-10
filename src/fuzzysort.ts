// https://github.com/farzher/fuzzysort v2.0.4
/*
  SublimeText-like Fuzzy Search

  fuzzysort.single('fs', 'Fuzzy Search') // {score: -16}
  fuzzysort.single('test', 'test') // {score: 0}
  fuzzysort.single('doesnt exist', 'target') // null

  fuzzysort.go('mr', [{file:'Monitor.cpp'}, {file:'MeshRenderer.cpp'}], {key:'file'})
  // [{score:-18, obj:{file:'MeshRenderer.cpp'}}, {score:-6009, obj:{file:'Monitor.cpp'}}]

  fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
  // [{score: -18, target: "MeshRenderer.cpp"}, {score: -6009, target: "Monitor.cpp"}]
*/

export interface Result {
  /**
   * Higher is better
   *
   * 0 is a perfect match; -1000 is a bad match
   */
  readonly score: number;

  /** Your original target string */
  readonly target: string;

  readonly refIndex: number;
}

export interface Results extends ReadonlyArray<Result> {
  /** Total matches before limit */
  readonly total: number;
}

export interface KeyResult<T> extends Result {
  /** Your original object */
  readonly obj: T;
}

export interface KeyResults<T> extends ReadonlyArray<KeyResult<T>> {
  /** Total matches before limit */
  readonly total: number;
}

export interface Prepared {
  /** Your original target string */
  readonly target: string;
  readonly _targetLower: string;
  readonly _targetLowerCodes: number[];
  _nextBeginningIndexes: number[] | null;
  readonly _bitflags: number;
  score: number;
  readonly _indexes: number[];
  readonly obj: any;
}

export interface Options {
  /** Don't return matches worse than this (higher is faster) */
  threshold?: number;

  /** Don't return more results than this (lower is faster) */
  limit?: number;

  /** If true, returns all results for an empty search */
  all?: boolean;
}

export interface KeyOptions extends Options {
  key: string | ReadonlyArray<string>;
}

export const single = (
  search: string,
  target: string | Prepared
): Prepared | null => {
  if (!search || !target) return NULL;

  var preparedSearch = getPreparedSearch(search);
  if (!isObj(target)) target = getPrepared(target as string);

  var searchBitflags = preparedSearch.bitflags;
  // @ts-expect-error
  if ((searchBitflags & target._bitflags) !== searchBitflags) return NULL;

  return algorithm(preparedSearch, target as Prepared);
};

export function go(
  search: string,
  targets: ReadonlyArray<string | Prepared | undefined>,
  options?: Options
): Results;
export function go<T>(
  search: string,
  targets: ReadonlyArray<T | undefined>,
  options: KeyOptions
): KeyResults<T>;
export function go(
  search: string,
  targets: ReadonlyArray<unknown>,
  options?: Options | KeyOptions
): Results | KeyResults<unknown> {
  if (!search) {
    // @ts-expect-error
    return options && options.all ? all(search, targets, options) : noResults;
  }

  var preparedSearch = getPreparedSearch(search);
  var searchBitflags = preparedSearch.bitflags;
  var containsSpace = preparedSearch.containsSpace;

  var threshold = (options && options.threshold) || INT_MIN;
  var limit = (options && options["limit"]) || INT_MAX; // for some reason only limit breaks when minified

  var resultsLen = 0;
  var limitedCount = 0;
  var targetsLen = targets.length;

  // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]

  // options.key
  if (options && "key" in options && options.key) {
    var key = options.key;
    for (var i = 0; i < targetsLen; ++i) {
      var obj = targets[i];
      var target = getValue(obj, key);
      if (!target) continue;
      if (!isObj(target)) target = getPrepared(target);

      if ((searchBitflags & target._bitflags) !== searchBitflags) continue;
      var result = algorithm(preparedSearch, target);
      if (result === NULL) continue;
      if (result.score < threshold) continue;

      // have to clone result so duplicate targets from different obj can each reference the correct obj
      result = {
        target: result.target,
        _targetLower: "",
        _targetLowerCodes: NULL,
        _nextBeginningIndexes: NULL,
        _bitflags: 0,
        score: result.score,
        _indexes: result._indexes,
        obj: obj,
        refIndex: i,
      }; // hidden

      if (resultsLen < limit) {
        // @ts-expect-error
        q.add(result);
        ++resultsLen;
      } else {
        ++limitedCount;
        // @ts-expect-error
        if (result.score > q.peek().score) q.replaceTop(result);
      }
    }
  } else {
    for (var i = 0; i < targetsLen; ++i) {
      // @ts-expect-error
      var target = targets[i];
      if (!target) continue;
      if (!isObj(target)) target = getPrepared(target);

      if ((searchBitflags & target._bitflags) !== searchBitflags) continue;
      var result = algorithm(preparedSearch, target);
      if (result === NULL) continue;
      result.refIndex = i;
      if (result.score < threshold) continue;
      if (resultsLen < limit) {
        // @ts-expect-error
        q.add(result);
        ++resultsLen;
      } else {
        ++limitedCount;
        // @ts-expect-error
        if (result.score > q.peek().score) q.replaceTop(result);
      }
    }
  }

  // @ts-expect-error
  if (resultsLen === 0) return noResults;
  var results = new Array(resultsLen);
  // @ts-expect-error
  for (var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll();
  // @ts-expect-error
  results.total = resultsLen + limitedCount;
  // @ts-expect-error
  return results;
}

export const indexes = (result: Result): number[] =>
  // @ts-expect-error
  result._indexes.slice(0, result._indexes.len).sort((a, b) => a - b);

export const prepare = (target: string): Prepared => {
  if (typeof target !== "string") target = "";
  var info = prepareLowerInfo(target);
  return {
    target: target,
    _targetLower: info._lower,
    _targetLowerCodes: info.lowerCodes,
    _nextBeginningIndexes: NULL,
    _bitflags: info.bitflags,
    score: NULL,
    _indexes: [0],
    obj: NULL,
  }; // hidden
};

// Below this point is only internal code
// Below this point is only internal code
// Below this point is only internal code
// Below this point is only internal code

var prepareSearch = (search) => {
  if (typeof search !== "string") search = "";
  search = search.trim();
  var info = prepareLowerInfo(search);

  var spaceSearches = [];
  if (info.containsSpace) {
    var searches = search.split(/\s+/);
    searches = [...new Set(searches)]; // distinct
    for (var i = 0; i < searches.length; i++) {
      if (searches[i] === "") continue;
      var _info = prepareLowerInfo(searches[i]);
      spaceSearches.push({
        lowerCodes: _info.lowerCodes,
        _lower: searches[i].toLowerCase(),
        containsSpace: false,
      });
    }
  }

  return {
    lowerCodes: info.lowerCodes,
    bitflags: info.bitflags,
    containsSpace: info.containsSpace,
    _lower: info._lower,
    spaceSearches: spaceSearches,
  };
};

var getPrepared = (target: string) => {
  if (target.length > 999) return prepare(target); // don't cache huge targets
  var targetPrepared = preparedCache.get(target);
  if (targetPrepared !== undefined) return targetPrepared;
  targetPrepared = prepare(target);
  preparedCache.set(target, targetPrepared);
  return targetPrepared;
};
var getPreparedSearch = (search: string) => {
  if (search.length > 999) return prepareSearch(search); // don't cache huge searches
  var searchPrepared = preparedSearchCache.get(search);
  if (searchPrepared !== undefined) return searchPrepared;
  searchPrepared = prepareSearch(search);
  preparedSearchCache.set(search, searchPrepared);
  return searchPrepared;
};

var all = (search: string, targets, options) => {
  var results = [];
  // @ts-expect-error
  results.total = targets.length;

  var limit = (options && options.limit) || INT_MAX;

  if (options && options.key) {
    for (var i = 0; i < targets.length; i++) {
      var obj = targets[i];
      var target = getValue(obj, options.key);
      if (!target) continue;
      if (!isObj(target)) target = getPrepared(target);
      target.score = INT_MIN;
      target._indexes.len = 0;
      var result = target;
      result = {
        target: result.target,
        _targetLower: "",
        _targetLowerCodes: NULL,
        _nextBeginningIndexes: NULL,
        _bitflags: 0,
        score: target.score,
        _indexes: NULL,
        refIndex: i,
        obj: obj,
      }; // hidden
      results.push(result);
      if (results.length >= limit) return results;
    }
  } else {
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      if (!target) continue;
      if (!isObj(target)) target = getPrepared(target);
      target.score = INT_MIN;
      target.refIndex = i;
      target._indexes.len = 0;
      results.push(target);
      if (results.length >= limit) return results;
    }
  }

  return results;
};

var algorithm = (preparedSearch, prepared: Prepared, allowSpaces = false) => {
  if (allowSpaces === false && preparedSearch.containsSpace)
    return algorithmSpaces(preparedSearch, prepared);

  var searchLower = preparedSearch._lower;
  var searchLowerCodes = preparedSearch.lowerCodes;
  var searchLowerCode = searchLowerCodes[0];
  var targetLowerCodes = prepared._targetLowerCodes;
  var searchLen = searchLowerCodes.length;
  var targetLen = targetLowerCodes.length;
  var searchI = 0; // where we at
  var targetI = 0; // where you at
  var matchesSimpleLen = 0;

  // very basic fuzzy match; to remove non-matching targets ASAP!
  // walk through target. find sequential matches.
  // if all chars aren't found then exit
  for (;;) {
    var isMatch = searchLowerCode === targetLowerCodes[targetI];
    if (isMatch) {
      matchesSimple[matchesSimpleLen++] = targetI;
      ++searchI;
      if (searchI === searchLen) break;
      searchLowerCode = searchLowerCodes[searchI];
    }
    ++targetI;
    if (targetI >= targetLen) return NULL; // Failed to find searchI
  }

  var searchI = 0;
  var successStrict = false;
  var matchesStrictLen = 0;

  var nextBeginningIndexes = prepared._nextBeginningIndexes;
  if (nextBeginningIndexes === NULL)
    nextBeginningIndexes = prepared._nextBeginningIndexes =
      prepareNextBeginningIndexes(prepared.target);
  var firstPossibleI = (targetI =
    matchesSimple[0] === 0 ? 0 : nextBeginningIndexes[matchesSimple[0] - 1]);

  // Our target string successfully matched all characters in sequence!
  // Let's try a more advanced and strict test to improve the score
  // only count it as a match if it's consecutive or a beginning character!
  var backtrackCount = 0;
  if (targetI !== targetLen)
    for (;;) {
      if (targetI >= targetLen) {
        // We failed to find a good spot for this search char, go back to the previous search char and force it forward
        if (searchI <= 0) break; // We failed to push chars forward for a better match

        ++backtrackCount;
        if (backtrackCount > 200) break; // exponential backtracking is taking too long, just give up and return a bad match

        --searchI;
        var lastMatch = matchesStrict[--matchesStrictLen];
        targetI = nextBeginningIndexes[lastMatch];
      } else {
        var isMatch = searchLowerCodes[searchI] === targetLowerCodes[targetI];
        if (isMatch) {
          matchesStrict[matchesStrictLen++] = targetI;
          ++searchI;
          if (searchI === searchLen) {
            successStrict = true;
            break;
          }
          ++targetI;
        } else {
          targetI = nextBeginningIndexes[targetI];
        }
      }
    }

  // check if it's a substring match
  var substringIndex = prepared._targetLower.indexOf(
    searchLower,
    matchesSimple[0]
  ); // perf: this is slow
  var isSubstring = ~substringIndex;
  if (isSubstring && !successStrict) {
    // rewrite the indexes from basic to the substring
    for (var i = 0; i < matchesSimpleLen; ++i)
      matchesSimple[i] = substringIndex + i;
  }
  var isSubstringBeginning = false;
  if (isSubstring) {
    isSubstringBeginning =
      prepared._nextBeginningIndexes[substringIndex - 1] === substringIndex;
  }

  {
    // tally up the score & keep track of matches for highlighting later
    if (successStrict) {
      var matchesBest = matchesStrict;
      var matchesBestLen = matchesStrictLen;
    } else {
      var matchesBest = matchesSimple;
      var matchesBestLen = matchesSimpleLen;
    }

    var score = 0;

    var extraMatchGroupCount = 0;
    for (var i = 1; i < searchLen; ++i) {
      if (matchesBest[i] - matchesBest[i - 1] !== 1) {
        score -= matchesBest[i];
        ++extraMatchGroupCount;
      }
    }
    var unmatchedDistance =
      matchesBest[searchLen - 1] - matchesBest[0] - (searchLen - 1);

    score -= (12 + unmatchedDistance) * extraMatchGroupCount; // penality for more groups

    if (matchesBest[0] !== 0) score -= matchesBest[0] * matchesBest[0] * 0.2; // penality for not starting near the beginning

    if (!successStrict) {
      score *= 1000;
    } else {
      // successStrict on a target with too many beginning indexes loses points for being a bad target
      var uniqueBeginningIndexes = 1;
      for (
        var i = nextBeginningIndexes[0];
        i < targetLen;
        i = nextBeginningIndexes[i]
      )
        ++uniqueBeginningIndexes;

      if (uniqueBeginningIndexes > 24)
        score *= (uniqueBeginningIndexes - 24) * 10; // quite arbitrary numbers here ...
    }

    if (isSubstring) score /= 1 + searchLen * searchLen * 1; // bonus for being a full substring
    if (isSubstringBeginning) score /= 1 + searchLen * searchLen * 1; // bonus for substring starting on a beginningIndex

    score -= targetLen - searchLen; // penality for longer targets
    prepared.score = score;

    for (var i = 0; i < matchesBestLen; ++i)
      prepared._indexes[i] = matchesBest[i];
    // @ts-expect-error
    prepared._indexes.len = matchesBestLen;

    return prepared;
  }
};
var algorithmSpaces = (preparedSearch, target) => {
  var seen_indexes = new Set();
  var score = 0;
  var result = NULL;

  var first_seen_index_last_search = 0;
  var searches = preparedSearch.spaceSearches;
  for (var i = 0; i < searches.length; ++i) {
    var search = searches[i];

    result = algorithm(search, target);
    if (result === NULL) return NULL;

    // @ts-expect-error
    score += result.score;

    // dock points based on order otherwise "c man" returns Manifest.cpp instead of CheatManager.h
    // @ts-expect-error
    if (result._indexes[0] < first_seen_index_last_search) {
      // @ts-expect-error
      score -= first_seen_index_last_search - result._indexes[0];
    }
    // @ts-expect-error
    first_seen_index_last_search = result._indexes[0];

    // @ts-expect-error
    for (var j = 0; j < result._indexes.len; ++j)
      // @ts-expect-error
      seen_indexes.add(result._indexes[j]);
  }

  // allows a search with spaces that's an exact substring to score well
  var allowSpacesResult = algorithm(
    preparedSearch,
    target,
    /*allowSpaces=*/ true
  );
  if (allowSpacesResult !== NULL && allowSpacesResult.score > score) {
    return allowSpacesResult;
  }

  // @ts-expect-error
  result.score = score;

  var i = 0;
  // @ts-expect-error
  for (let index of seen_indexes) result._indexes[i++] = index;
  // @ts-expect-error
  result._indexes.len = i;

  return result;
};

var prepareLowerInfo = (str: string) => {
  var strLen = str.length;
  var lower = str.toLowerCase();
  var lowerCodes: number[] = []; // new Array(strLen)    sparse array is too slow
  var bitflags = 0;
  var containsSpace = false; // space isn't stored in bitflags because of how searching with a space works

  for (var i = 0; i < strLen; ++i) {
    var lowerCode = (lowerCodes[i] = lower.charCodeAt(i));

    if (lowerCode === 32) {
      containsSpace = true;
      continue; // it's important that we don't set any bitflags for space
    }

    var bit =
      lowerCode >= 97 && lowerCode <= 122
        ? lowerCode - 97 // alphabet
        : lowerCode >= 48 && lowerCode <= 57
        ? 26 // numbers
        : // 3 bits available
        lowerCode <= 127
        ? 30 // other ascii
        : 31; // other utf8
    bitflags |= 1 << bit;
  }

  return {
    lowerCodes: lowerCodes,
    bitflags: bitflags,
    containsSpace: containsSpace,
    _lower: lower,
  };
};
var prepareBeginningIndexes = (target) => {
  var targetLen = target.length;
  var beginningIndexes = [];
  var beginningIndexesLen = 0;
  var wasUpper = false;
  var wasAlphanum = false;
  for (var i = 0; i < targetLen; ++i) {
    var targetCode = target.charCodeAt(i);
    var isUpper = targetCode >= 65 && targetCode <= 90;
    var isAlphanum =
      isUpper ||
      (targetCode >= 97 && targetCode <= 122) ||
      (targetCode >= 48 && targetCode <= 57);
    var isBeginning = (isUpper && !wasUpper) || !wasAlphanum || !isAlphanum;
    wasUpper = isUpper;
    wasAlphanum = isAlphanum;
    if (isBeginning) beginningIndexes[beginningIndexesLen++] = i;
  }
  return beginningIndexes;
};
var prepareNextBeginningIndexes = (target: string) => {
  var targetLen = target.length;
  var beginningIndexes = prepareBeginningIndexes(target);
  var nextBeginningIndexes: number[] = []; // new Array(targetLen)     sparse array is too slow
  var lastIsBeginning = beginningIndexes[0];
  var lastIsBeginningI = 0;
  for (var i = 0; i < targetLen; ++i) {
    if (lastIsBeginning > i) {
      nextBeginningIndexes[i] = lastIsBeginning;
    } else {
      lastIsBeginning = beginningIndexes[++lastIsBeginningI];
      nextBeginningIndexes[i] =
        lastIsBeginning === undefined ? targetLen : lastIsBeginning;
    }
  }
  return nextBeginningIndexes;
};

export const cleanup = () => {
  preparedCache.clear();
  preparedSearchCache.clear();
  matchesSimple = [];
  matchesStrict = [];
};

var preparedCache = new Map();
var preparedSearchCache = new Map();
var matchesSimple = [];
var matchesStrict = [];

// prop = 'key'              2.5ms optimized for this case, seems to be about as fast as direct obj[prop]
// prop = 'key1.key2'        10ms
// prop = ['key1', 'key2']   27ms
var getValue = (obj, prop) => {
  var tmp = obj[prop];
  if (tmp !== undefined) return tmp;
  var segs = prop;
  if (!Array.isArray(prop)) segs = prop.split(".");
  var len = segs.length;
  var i = -1;
  while (obj && ++i < len) obj = obj[segs[i]];
  return obj;
};

var isObj = (x) => {
  return typeof x === "object";
}; // faster as a function
// var INT_MAX = 9007199254740991; var INT_MIN = -INT_MAX
var INT_MAX = Infinity;
var INT_MIN = -INT_MAX;
var noResults = [];
// @ts-expect-error
noResults.total = 0;
var NULL: null = null;

// Hacked version of https://github.com/lemire/FastPriorityQueue.js
var fastpriorityqueue = (r) => {
  var e = [],
    o = 0,
    a = {},
    v = (r) => {
      for (var a = 0, v = e[a], c = 1; c < o; ) {
        var s = c + 1;
        (a = c),
          s < o && e[s].score < e[c].score && (a = s),
          (e[(a - 1) >> 1] = e[a]),
          (c = 1 + (a << 1));
      }
      for (
        var f = (a - 1) >> 1;
        a > 0 && v.score < e[f].score;
        f = ((a = f) - 1) >> 1
      )
        e[a] = e[f];
      e[a] = v;
    };
  return (
    // @ts-expect-error
    (a.add = (r) => {
      var a = o;
      e[o++] = r;
      for (
        var v = (a - 1) >> 1;
        a > 0 && r.score < e[v].score;
        v = ((a = v) - 1) >> 1
      )
        e[a] = e[v];
      e[a] = r;
    }),
    // @ts-expect-error
    (a.poll = (r) => {
      if (0 !== o) {
        var a = e[0];
        // @ts-expect-error
        return (e[0] = e[--o]), v(), a;
      }
    }),
    // @ts-expect-error
    (a.peek = (r) => {
      if (0 !== o) return e[0];
    }),
    // @ts-expect-error
    (a.replaceTop = (r) => {
      // @ts-expect-error
      (e[0] = r), v();
    }),
    a
  );
};
// @ts-expect-error
var q = fastpriorityqueue(); // reuse this

// TODO: (feature) frecency
// TODO: (perf) use different sorting algo depending on the # of results?
// TODO: (perf) preparedCache is a memory leak
// TODO: (like sublime) backslash === forwardslash
// TODO: (perf) prepareSearch seems slow
