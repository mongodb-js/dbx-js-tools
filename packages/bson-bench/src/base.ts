import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import * as process from 'process';

import {
  type BenchmarkResult,
  type BenchmarkSpecification,
  type BSONLib,
  type ConstructibleBSON,
  Package,
  type RunBenchmarkMessage
} from './common';

function exit(code: number) {
  process.disconnect();
  process.exit(code);
}

function reportResultAndQuit(result: BenchmarkResult) {
  if (process.send) {
    process.send({ type: 'returnResult', result }, null, {}, () => exit(0));
    return;
  }
  exit(0);
}

function reportErrorAndQuit(error: Error) {
  if (process.send) {
    process.send(
      {
        type: 'returnError',
        error
      },
      null,
      {},
      () => exit(0)
    );
    return;
  }

  exit(1);
}

function run(bson: BSONLib | ConstructibleBSON, config: BenchmarkSpecification) {
  let fn:
    | ((b: Uint8Array, options?: any) => any)
    | ((o: any, options?: any) => Uint8Array)
    | undefined = undefined;
  let documentSizeBytes: number;
  let doc: any;

  // Check if this is bson < v4
  if (typeof bson === 'function') bson = new bson();

  try {
    if (bson.EJSON) doc = bson.EJSON.parse(readFileSync(config.documentPath, 'utf8'));
    else throw new Error('No EJSON parser found');
  } catch (cause) {
    reportErrorAndQuit(new Error('Failed to read test document', { cause }));
    return;
  }

  switch (config.operation) {
    case 'serialize':
      fn = bson.serialize;
      try {
        documentSizeBytes = fn(doc).byteLength;
      } catch (cause) {
        reportErrorAndQuit(new Error('failed to calculate input object size', { cause }));
        return;
      }
      break;
    case 'deserialize':
      fn = bson.deserialize;
      try {
        doc = bson.serialize(doc);
        documentSizeBytes = doc.byteLength;
      } catch (cause) {
        reportErrorAndQuit(new Error('failed to serialize input object', { cause }));
        return;
      }
      break;
    default:
      reportErrorAndQuit(new Error('unknown test type'));
      return;
  }

  // Check if we can successfully run function under test and report failure if not
  try {
    fn(doc, config.options);
  } catch (cause) {
    reportErrorAndQuit(new Error('operation under test failed', { cause }));
  }

  // Run warmup iterations
  for (let i = 0; i < config.warmup; i++) {
    fn(doc, config.options);
  }

  const durationMillis: number[] = [];
  let start: number;
  let end: number;
  for (let i = 0; i < config.iterations; i++) {
    start = performance.now();
    fn(doc, config.options);
    end = performance.now();
    durationMillis.push(end - start);
  }

  reportResultAndQuit({ durationMillis, documentSizeBytes });
}

function listener(message: RunBenchmarkMessage) {
  if (message.type === 'runBenchmark') {
    const packageSpec = new Package(message.benchmark.library, message.benchmark.installLocation);
    let bson: BSONLib;
    try {
      bson = require(
        join(message.benchmark.installLocation, 'node_modules', packageSpec.computedModuleName)
      );
    } catch (error) {
      reportErrorAndQuit(error as Error);
      return;
    }

    run(bson, message.benchmark);
  } else {
    reportErrorAndQuit(new Error(`unknown ipc message: ${message}`));
  }
}

process.on('message', listener);
