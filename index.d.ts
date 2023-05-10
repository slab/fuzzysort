declare namespace Fuzzysort {
  interface Result {
    /**
     * Higher is better
     *
     * 0 is a perfect match; -1000 is a bad match
     */
    readonly score: number;

    /** Your original target string */
    readonly target: string;
  }
  interface Results extends ReadonlyArray<Result> {
    /** Total matches before limit */
    readonly total: number;
  }

  interface KeyResults<T> extends ReadonlyArray<Result> {
    /** Your original object */
    readonly obj: T;
    /** Total matches before limit */
    readonly total: number;
  }

  interface Prepared {
    /** Your original target string */
    readonly target: string;
  }

  interface Options {
    /** Don't return matches worse than this (higher is faster) */
    threshold?: number;

    /** Don't return more results than this (lower is faster) */
    limit?: number;

    /** If true, returns all results for an empty search */
    all?: boolean;
  }
  interface KeyOptions extends Options {
    key: string | ReadonlyArray<string>;
  }

  interface Fuzzysort {
    single(search: string, target: string | Prepared): Result | null;

    go(
      search: string,
      targets: ReadonlyArray<string | Prepared | undefined>,
      options?: Options
    ): Results;
    go<T>(
      search: string,
      targets: ReadonlyArray<T | undefined>,
      options: KeyOptions
    ): KeyResults<T>;

    indexes(result: Result): ReadonlyArray<Number>;
    cleanup(): void;

    /**
     * Help the algorithm go fast by providing prepared targets instead of raw strings
     */
    prepare(target: string): Prepared;
  }
}

declare module "fuzzysort" {
  const fuzzysort: Fuzzysort.Fuzzysort;
  export = fuzzysort;
}
