import { writeFile } from "fs/promises";

import { type BenchmarkResult, type BenchmarkSpecification } from "./common";
import { Task } from "./task";

export class Suite {
  tasks: Task[];
  name: string;
  errors: { task: Task; error: Error }[];

  constructor(name: string) {
    this.name = name;
    this.tasks = [];
    this.errors = [];
  }

  task(benchmarkSpec: BenchmarkSpecification): Suite {
    this.tasks.push(new Task(benchmarkSpec));
    return this;
  }

  async run(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    for (const task of this.tasks) {
      const result = await task.run().then(
        (r: BenchmarkResult) => r,
        (e: Error) => e,
      );
      if (result instanceof Error) this.errors.push({ task, error: result });
      else results.push(result);
    }

    return results;
  }

  async writeResults(fileName?: string): Promise<void> {
    const results = this.tasks.map((task: Task) => task.getResults());
    const outputFileName = fileName ?? "results.json";

    await writeFile(outputFileName, JSON.stringify(results, undefined, 2));
  }
}
