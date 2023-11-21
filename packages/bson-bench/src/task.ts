import { type ChildProcess, fork } from 'child_process';
import { once } from 'events';
import { writeFile } from 'fs/promises';
import * as path from 'path';

import {
  type BenchmarkResult,
  type BenchmarkSpecification,
  type ErrorMessage,
  Package,
  type PerfSendResult,
  type ResultMessage
} from './common';

/**
 * An individual benchmark task that runs in its own Node.js process
 */
export class Task {
  result: BenchmarkResult | undefined;
  benchmark: BenchmarkSpecification;
  taskName: string;
  /** @internal */
  children: ChildProcess[];
  /** @internal */
  hasRun: boolean;

  constructor(benchmarkSpec: BenchmarkSpecification) {
    this.result = undefined;
    this.benchmark = benchmarkSpec;
    this.children = [];
    this.hasRun = false;

    this.taskName = `${path.basename(this.benchmark.documentPath, 'json')}_${
      this.benchmark.operation
    }_${this.benchmark.library}`;
  }

  /**
   * If the Task has been run, calculates summary statistics and returns results in format expected
   * by [perf.send](https://docs.devprod.prod.corp.mongodb.com/evergreen/Project-Configuration/Project-Commands#perfsend).
   *
   * Throws error is Task has not been run or failed to generate results previously
   */
  getResults(): PerfSendResult {
    if (!this.hasRun) throw new Error('cannot write results if benchmark has not been run');
    if (!this.result) throw new Error('benchmark failed; no results to write');

    const { durationMillis, documentSizeBytes } = this.result;
    const calculateThroughputMBps = (durationMillis: number, bytes: number) =>
      bytes / durationMillis / 1000.0;
    const throughputMBps = durationMillis.map(d => calculateThroughputMBps(d, documentSizeBytes));
    throughputMBps.sort((a, b) => a - b);

    // Calculate summary statistics
    const meanThroughputMBps =
      throughputMBps.reduce((prev, thrpt) => thrpt + prev, 0) / throughputMBps.length;
    const medianThroughputMBps: number =
      throughputMBps.length % 2 === 0
        ? (throughputMBps[throughputMBps.length / 2] +
            throughputMBps[throughputMBps.length / 2 - 1]) /
          2
        : throughputMBps[throughputMBps.length / 2];
    const maxThroughputMBps = throughputMBps[throughputMBps.length - 1];
    const minThroughputMBps = throughputMBps[0];
    const throughputMBpsVariance =
      throughputMBps.map(x => (x - meanThroughputMBps) ** 2).reduce((x, y) => x + y) /
      throughputMBps.length;
    const throughputMBpsStddev = Math.sqrt(throughputMBpsVariance);

    const convertOptions = (o: any): any => {
      const output = Object.create(null);
      for (const key in o) {
        // boolean options
        switch (key) {
          case 'promoteValues':
          case 'promoteBuffers':
          case 'promoteLongs':
          case 'bsonRegExp':
          case 'allowObjectSmallerThanBufferSize':
          case 'useBigInt64':
          case 'evalFunctions':
          case 'cacheFunctions':
          case 'checkKeys':
          case 'ignoreUndefined':
          case 'serializeFunctions':
            output[key] = Number(o[key]);
            break;
          // numeric options
          case 'index':
            output[key] = o[key];
            break;
          // special cases
          case 'validation':
            // utf8 validation is always on for bson-ext
            output['utf8Validation'] = /^bson-ext/.test(this.benchmark.library)
              ? 1
              : // if value of boolean for js-bson, convert to number, otherwise assume true
              typeof o[key]['utf8'] === 'boolean'
              ? Number(o[key]['utf8'])
              : 1;
            break;
          default:
            output[key] =
              typeof o[key] === 'boolean' || typeof o[key] === 'number' ? Number(o[key]) : -1;
        }
      }

      return output;
    };
    const optionsWithNumericFields = convertOptions(this.benchmark.options);

    const perfSendResults: PerfSendResult = {
      info: {
        test_name: this.taskName,
        args: {
          warmup: this.benchmark.warmup,
          iterations: this.benchmark.iterations,
          ...optionsWithNumericFields
        }
      },
      metrics: [
        {
          name: 'mean_megabytes_per_second',
          type: 'MEAN',
          value: meanThroughputMBps
        },
        {
          name: 'median_megabytes_per_second',
          type: 'MEDIAN',
          value: medianThroughputMBps
        },
        {
          name: 'min_megabytes_per_second',
          type: 'MIN',
          value: minThroughputMBps
        },
        {
          name: 'max_megabytes_per_second',
          type: 'MAX',
          value: maxThroughputMBps
        },
        {
          name: 'stddev_megabytes_per_second',
          type: 'STANDARD_DEVIATION',
          value: throughputMBpsStddev
        }
      ]
    };

    return perfSendResults;
  }

  /**
   * Writes out result to file with name determined by test configuration
   */
  async writeResults(): Promise<void> {
    const perfSendResults = this.getResults();

    await writeFile(
      `${perfSendResults.info.test_name}.json`,
      JSON.stringify(perfSendResults, undefined, 2)
    );
  }

  /**
   * Runs benchmark in separate Node.js process and returns results once it successfully completes.
   * Throws an error if the benchmark failed to complete
   */
  async run(): Promise<BenchmarkResult> {
    if (this.hasRun && this.result) return this.result;

    // install required modules before running child process as new Node processes need to know that
    // it exists before they can require it.
    const pack = new Package(this.benchmark.library);
    if (!pack.check()) await pack.install();
    // spawn child process
    const child = fork(`${__dirname}/base`, {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      serialization: 'advanced'
    });
    child.send({ type: 'runBenchmark', benchmark: this.benchmark });
    this.children.push(child);

    // listen for results or error
    const resultOrError: ResultMessage | ErrorMessage = (await once(child, 'message'))[0];

    // wait for child to close
    await once(child, 'exit');

    this.hasRun = true;
    switch (resultOrError.type) {
      case 'returnResult':
        this.result = resultOrError.result;
        return resultOrError.result;
      case 'returnError':
        throw resultOrError.error;
      default:
        throw new Error('Unexpected result returned from child process');
    }
  }
}
