import { writeFile } from "fs/promises";

import {
  type BenchmarkResult,
  type BenchmarkSpecification,
  type PerfSendResult,
} from "./common";
import { Task } from "./task";

export class Suite {
  tasks: Task[];
  name: string;
  hasRun: boolean;
  _errors: { task: Task; error: Error }[];
  private _results: PerfSendResult[];

  constructor(name: string) {
    this.name = name;
    this.hasRun = false;
    this.tasks = [];
    this._errors = [];
    this._results = [];
  }

  task(benchmarkSpec: BenchmarkSpecification): Suite {
    this.tasks.push(new Task(benchmarkSpec));
    return this;
  }

  async run(): Promise<void> {
    if (this.hasRun) throw new Error("Suite has already been run");

    console.log(`Suite: ${this.name}`);
    for (const task of this.tasks) {
      const result = await task.run().then(
        (_r: BenchmarkResult) => task.getResults(),
        (e: Error) => e,
      );
      if (result instanceof Error) {
        console.log(`\t${task.taskName} ✗`);
        this._errors.push({ task, error: result });
      } else {
        console.log(`\t${task.taskName} ✓`);
        this._results.push(result);
      }
    }

    for (const { task, error } of this._errors) {
      console.log(`Task ${task.taskName} failed with Error '${error.message}'`);
    }

    this.hasRun = true;
  }

  get results(): PerfSendResult[] {
    return this._results;
  }

  get errors(): { task: Task; error: Error }[] {
    return this._errors;
  }

  async writeResults(fileName?: string): Promise<void> {
    const outputFileName = fileName ?? "results.json";

    await writeFile(outputFileName, JSON.stringify(this.results, undefined, 2));
  }
}
