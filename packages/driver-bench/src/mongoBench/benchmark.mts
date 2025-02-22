export type BenchmarkLike = {
  _taskType: string;
  task: () => void;
  taskSize: number;
  description: string;
  setup: () => Promise<void>;
  beforeTask: () => Promise<void>;
  afterTask: () => Promise<void>;
  teardown: () => Promise<void>;
};

export class Benchmark {
  private _task: () => void;
  private _setup: (() => void)[];
  private _beforeTask: (() => void)[];
  private _afterTask: (() => void)[];
  private _teardown: (() => void)[];
  private _taskSize: number | null;
  private _description: string | null;
  private _taskType: string;

  constructor() {
    // The Task itself
    this._task = null;

    // Lifecycle Hooks
    this._setup = [];
    this._beforeTask = [];
    this._afterTask = [];
    this._teardown = [];

    // Meta information
    this._taskSize = null;
    this._description = null;
    this._taskType = 'async';
  }

  /**
   * Set the task to benchmark
   *
   * @param fn - The task to benchmark
   */
  task(fn): this {
    if (typeof fn !== 'function') {
      throw new TypeError(`Argument fn (${fn}) must be a function`);
    }

    if (this._task != null) {
      throw new Error('You cannot have more than one task per benchmark');
    }

    this._task = fn;

    return this;
  }

  /**
   * Add a setup lifecycle hook
   *
   * @param fn - The lifecycle hook
   */
  setup(fn): this {
    return this._pushLifecycleHook(this._setup, fn);
  }

  /**
   * Add a beforeTask lifecycle hook
   *
   * @param fn - The lifecycle hook
   */
  beforeTask(fn): this {
    return this._pushLifecycleHook(this._beforeTask, fn);
  }

  /**
   * Add an afterTask lifecycle hook
   *
   * @param fn - The lifecycle hook
   */
  afterTask(fn): this {
    return this._pushLifecycleHook(this._afterTask, fn);
  }

  /**
   * Add a teardown lifecycle hook
   *
   * @param fn - The lifecycle hook
   */
  teardown(fn): this {
    return this._pushLifecycleHook(this._teardown, fn);
  }

  /**
   * Set the Task Size
   *
   * @param size - The Task Size in MB
   */
  taskSize(size: number): this {
    if (!(Number.isFinite(size) && size > 0)) {
      throw new TypeError(`size (${size}) must be a finite number greater than zero`);
    }

    if (this._taskSize != null) {
      throw new Error(`taskSize has already been set`);
    }

    this._taskSize = size;

    return this;
  }

  /**
   * Sets the task type - either a synchronous or asynchronous task.  The default is async.
   *
   * @param type - the type of task
   */
  taskType(type: 'async' | 'sync'): this {
    if (['async', 'sync'].includes(type)) {
      this._taskType = type;
    } else {
      throw new Error(
        `Invalid value for benchmark field _taskType: expected either 'async' or 'sync', but received ${type}`
      );
    }

    return this;
  }

  /**
   * Set the Description
   *
   * @param description - The description of the benchmark
   */
  description(description: string): this {
    if (typeof description !== 'string' || !description) {
      throw new TypeError(`description (${description}) must be a non-zero length string`);
    }

    if (this._description != null) {
      throw new Error(`description has already been set`);
    }

    this._description = description;

    return this;
  }

  /**
   * Validates that the benchmark has all the fields necessary
   *
   * @throws Error
   */
  validate() {
    for (const key of ['_task', '_taskSize', '_taskType']) {
      if (!this[key]) {
        throw new Error(`Benchmark is missing required field ${key}`);
      }
    }
  }

  toObj(): BenchmarkLike {
    return {
      // Required Fields
      task: this._task,
      taskSize: this._taskSize,

      _taskType: this._taskType,

      // Optional Fields
      description: this._description || `Performance test`,
      setup: this._convertArrayToAsyncPipeFn(this._setup),
      beforeTask: this._convertArrayToAsyncPipeFn(this._beforeTask),
      afterTask: this._convertArrayToAsyncPipeFn(this._afterTask),
      teardown: this._convertArrayToAsyncPipeFn(this._teardown)
    };
  }

  _pushLifecycleHook(hookList, fn): this {
    if (Array.isArray(fn)) {
      fn.forEach(f => this._pushLifecycleHook(hookList, f));
      return this;
    }

    if (typeof fn !== 'function') {
      throw new TypeError(`Parameter ${fn} must be a function`);
    }

    hookList.push(fn);
    return this;
  }

  /**
   * Converts an array of task functions into a single async function, that awaits each
   * task function and resolves once all are completed.
   *
   * The returned function will reject if any of the task functions fails.
   */
  _convertArrayToAsyncPipeFn(arr): () => Promise<void> {
    const array = arr.length ? arr : [];
    return async function () {
      // copy the array to guard against modification
      const chain = [].concat(array);
      for (const fn of chain) {
        await fn.call(this);
      }
    };
  }
}
