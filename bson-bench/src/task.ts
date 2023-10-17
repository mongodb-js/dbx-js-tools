import { type ChildProcess, fork } from "child_process";
import { once } from "events";
import { writeFile } from "fs/promises";
import * as path from "path";

import {
  type BenchmarkResult,
  type BenchmarkSpecification,
  type ErrorMessage,
  Package,
  type PerfSendResult,
  type ResultMessage,
} from "./common";

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

    const fileName = path.basename(benchmarkSpec.documentPath, ".json");
    this.taskName = `${fileName}-${benchmarkSpec.operation}`;
  }

  getResults(): PerfSendResult {
    if (!this.hasRun)
      throw new Error("cannot write results if benchmark has not been run");
    if (!this.result) throw new Error("benchmark failed; no results to write");

    const { durationMillis, documentSizeBytes } = this.result;
    const calculateThroughputMBps = (durationMillis: number, bytes: number) =>
      bytes / durationMillis / 1000;
    const throughputMBps = durationMillis.map((d) =>
      calculateThroughputMBps(d, documentSizeBytes),
    );
    throughputMBps.sort();

    // Calculate summary statistics
    const meanThroughputMBps =
      throughputMBps.reduce((prev, thrpt) => thrpt + prev, 0) /
      throughputMBps.length;
    const medianThroughputMBps = throughputMBps[throughputMBps.length / 2];
    const maxThroughputMBps = throughputMBps[throughputMBps.length - 1];
    const minThroughputMBps = throughputMBps[0];

    const testName = `${path.basename(this.benchmark.documentPath, "json")}_${
      this.benchmark.operation
    }_${this.benchmark.library}`;

    const optionsWithNumericFields = Object.keys(this.benchmark.options).reduce(
      (acc, key) => {
        if (
          typeof this.benchmark.options[key] === "boolean" ||
          typeof this.benchmark.options[key] === "number"
        ) {
          acc[key] = Number(this.benchmark.options[key]);
        }
        return acc;
      },
      {} as any,
    );

    const perfSendResults: PerfSendResult = {
      info: {
        test_name: testName,
        args: {
          warmup: this.benchmark.warmup,
          iterations: this.benchmark.iterations,
          ...optionsWithNumericFields,
        },
      },
      metrics: [
        {
          name: "megabytes_per_second",
          type: "MEAN",
          value: meanThroughputMBps,
        },
        {
          name: "megabytes_per_second",
          type: "MEDIAN",
          value: medianThroughputMBps,
        },
        {
          name: "megabytes_per_second",
          type: "MIN",
          value: minThroughputMBps,
        },
        {
          name: "megabytes_per_second",
          type: "MAX",
          value: maxThroughputMBps,
        },
      ],
    };

    return perfSendResults;
  }

  async writeResults(): Promise<void> {
    const perfSendResults = this.getResults();

    await writeFile(
      `${perfSendResults.info.test_name}.json`,
      JSON.stringify(perfSendResults, undefined, 2),
    );
  }

  private sendBenchmark(child: ChildProcess): void {
    child.send({ type: "runBenchmark", benchmark: this.benchmark });
  }

  async run(): Promise<BenchmarkResult> {
    if (this.hasRun && this.result) return this.result;

    // install required modules before running child process as new Node processes need to know that
    // it exists before they can require it.
    const pack = new Package(this.benchmark.library);
    if (!pack.check()) await pack.install();
    // spawn child process
    const child = fork(`${__dirname}/base.js`, {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    });
    this.sendBenchmark(child);
    this.children.push(child);

    // listen for results or error
    const resultOrError: ResultMessage | ErrorMessage = (
      await once(child, "message")
    )[0];

    // wait for child to close
    await once(child, "exit");

    this.hasRun = true;
    switch (resultOrError.type) {
      case "returnResult":
        this.result = resultOrError.result;
        return resultOrError.result;
      case "returnError":
        throw resultOrError.error;
    }
  }
}
