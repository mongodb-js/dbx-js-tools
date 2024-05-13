import { Benchmark } from './benchmark.mjs';

export class Suite {
  private children: Record<string, Benchmark>;

  constructor() {
    this.children = {};
  }

  /**
   * @param name - the name of the benchmark
   * @param fn - a function that configures the `benchmark` parameter
   */
  benchmark(name: string, fn: (benchmark: Benchmark) => Benchmark | null | undefined): this {
    if (typeof name !== 'string' || !name) {
      throw new TypeError(`Argument "name" (${name}) must be a non-zero length string`);
    }

    if (typeof fn !== 'function') {
      throw new TypeError(`Argument "fn" must be a function`);
    }

    if (name in this.children) {
      throw new Error(`Name "${name}" already taken`);
    }

    const _benchmark = new Benchmark();
    const benchmark = fn(_benchmark) || _benchmark;

    if (!(benchmark instanceof Benchmark)) {
      throw new TypeError(`returned object is not a benchmark`);
    }

    benchmark.validate();

    this.children[name] = benchmark;

    return this;
  }

  getBenchmarks() {
    return this.children;
  }
}
