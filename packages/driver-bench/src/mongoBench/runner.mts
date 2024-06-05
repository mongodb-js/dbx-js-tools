import type { BenchmarkLike } from './benchmark.mjs';
import * as CONSTANTS from './constants.mjs';
import { Suite } from './suite.mjs';

const PERCENTILES = [10, 25, 50, 75, 95, 98, 99];
function percentileIndex(percentile, total) {
  return Math.max(Math.floor((total * percentile) / 100 - 1), 0);
}

function timeSyncTask(task, ctx) {
  const start = performance.now();
  task.call(ctx);
  const end = performance.now();

  return (end - start) / 1000;
}

async function timeAsyncTask(task, ctx) {
  const start = performance.now();
  await task.call(ctx);
  const end = performance.now();

  return (end - start) / 1000;
}

/**
 * Returns the execution time for the benchmarks in mb/second
 *
 * This function internally calculates the 50th percentile execution time and uses
 * that as the median.
 */
function calculateMicroBench(
  benchmark: BenchmarkLike,
  data: { rawData: number[]; count: number }
): number {
  const rawData = data.rawData;
  const count = data.count;

  const sortedData = [].concat(rawData).sort();

  const percentiles = PERCENTILES.reduce((acc, pct) => {
    acc[pct] = sortedData[percentileIndex(pct, count)];
    return acc;
  }, {});

  const medianExecution = percentiles[50];

  return benchmark.taskSize / medianExecution;
}

export type RunnerOptions = {
  minExecutionTime?: number;
  maxExecutionTime?: number;
  minExecutionCount?: number;
  reporter?: (message?: any, ...optionalParams: any[]) => void;
  /** Only run TEST NAMES that match */
  grep?: string;
};

export class Runner {
  private minExecutionTime: number;
  private maxExecutionTime: number;
  private minExecutionCount: number;
  private reporter: (message?: any, ...optionalParams: any[]) => void;
  private children: Record<string, Suite>;
  private grep: RegExp | null;

  constructor(options: RunnerOptions = {}) {
    this.minExecutionTime = options.minExecutionTime || CONSTANTS.DEFAULT_MIN_EXECUTION_TIME;
    this.maxExecutionTime = options.maxExecutionTime || CONSTANTS.DEFAULT_MAX_EXECUTION_TIME;
    this.minExecutionCount = options.minExecutionCount || CONSTANTS.DEFAULT_MIN_EXECUTION_COUNT;
    this.reporter = options.reporter ?? console.log.bind(console);
    this.grep = options.grep ? new RegExp(options.grep, 'i') : null;
    this.children = {};
  }

  /**
   * Adds a new test suite to the runner
   * @param name - the name of the test suite
   * @param fn - a function that registers a set of benchmarks onto the parameter `suite`
   */
  suite(name: string, fn: (suite: Suite) => Suite | null | undefined): this {
    if (typeof name !== 'string' || !name) {
      throw new TypeError(`Argument "name" (${name}) must be a non-zero length string`);
    }

    if (typeof fn !== 'function') {
      throw new TypeError(`Argument "fn" must be a function`);
    }

    if (name in this.children) {
      throw new Error(`Name "${name}" already taken`);
    }

    const _suite = new Suite();
    const suite = fn(_suite) || _suite;

    if (!(suite instanceof Suite)) {
      throw new TypeError(`returned object is not a suite`);
    }

    this.children[name] = suite;

    return this;
  }

  async run() {
    this.reporter(`Running Benchmarks`);
    const result: Record<string, Record<string, number>> = {};

    for (const [suiteName, suite] of Object.entries(this.children)) {
      this.reporter(`  Executing suite "${suiteName}"`);
      result[suiteName] = await this._runSuite(suite);
    }

    return result;
  }

  async _runSuite(suite: Suite): Promise<Record<string, number>> {
    const benchmarks = Object.entries(suite.getBenchmarks()).map(
      ([name, benchmark]) => [name, benchmark.toObj()] as const
    );

    const result: Record<string, number> = {};

    for (const [name, benchmark] of benchmarks) {
      if (this.grep && !this.grep.test(name)) {
        this.reporter(`    Skipping Benchmark "${name}"`);
        result[name] = 0;
        continue;
      }
      this.reporter(`    Executing Benchmark "${name}"`);
      result[name] = await this._runBenchmark(benchmark);
      this.reporter(`    Result ${result[name].toFixed(4)} MB/s`);
    }

    return result;
  }

  /**
   * Runs a single benchmark.
   *
   * @returns A promise containing the mb/s for the benchmark.  This function never rejects,
   * it instead returns Promise<NaN> if there is an error.
   */
  async _runBenchmark(benchmark: BenchmarkLike): Promise<number> {
    const ctx = {};
    try {
      await benchmark.setup.call(ctx);
      const result = await this._loopTask(benchmark, ctx);
      await benchmark.teardown.call(ctx);
      return calculateMicroBench(benchmark, result);
    } catch (error) {
      return this._errorHandler(error);
    }
  }

  async _loopTask(
    benchmark: BenchmarkLike,
    ctx: any
  ): Promise<{ rawData: number[]; count: number }> {
    const start = performance.now();
    const rawData = [];
    const minExecutionCount = this.minExecutionCount;
    const minExecutionTime = this.minExecutionTime;
    const maxExecutionTime = this.maxExecutionTime;
    let time = performance.now() - start;
    let count = 1;

    const taskTimer = benchmark._taskType === 'sync' ? timeSyncTask : timeAsyncTask;

    while (time < maxExecutionTime && (time < minExecutionTime || count < minExecutionCount)) {
      await benchmark.beforeTask.call(ctx);
      const executionTime = await taskTimer(benchmark.task, ctx);
      rawData.push(executionTime);
      count++;
      time = performance.now();
    }

    return {
      rawData,
      count
    };
  }

  _errorHandler(e) {
    console.error(e);
    return NaN;
  }
}
