/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unused-vars */
const {
  Package,
  BSONLib,
  BenchmarkSpecification,
  RunBenchmarkMessage,
  BenchmarkResult,
} = require(`${__dirname}/common`);
/* eslint-enable @typescript-eslint/no-unused-vars */

const { performance } = require("perf_hooks");
const fs = require("fs");
const process = require("process");
const BSON = require("bson");

/**
 * @param result {BenchmarkResult}
 * */
function reportResultAndQuit(result) {
  if (process.send) process?.send({ type: "returnResult", result });
  process.disconnect();
  process.exit(0);
}

/**
 * @param error {Error}
 */
function reportErrorAndQuit(error) {
  if (process.send)
    process.send({
      type: "returnError",
      error,
    });
  process.disconnect();
  process.exit(1);
}

/**
 * @param bson {BSONLib}
 * @param config {BenchmarkSpecification}
 */
function run(bson, config) {
  /** @type {((b: Uint8Array, options: any) => any) | ((o: any, options: any) => Uint8Array)} */
  let fn;
  /** @type number */
  let size;

  let doc = BSON.EJSON.parse(fs.readFileSync(config.documentPath, "utf8"));

  switch (config.operation) {
    case "serialize":
      fn = bson.serialize;
      try {
        size = BSON.calculateObjectSize(doc);
      } catch (e) {
        const error = new Error("failed to calculate input object size");
        error.cause = e;
        reportErrorAndQuit(error);
      }
      break;
    case "deserialize":
      fn = bson.deserialize;
      try {
        doc = BSON.serialize(doc);
      } catch (e) {
        const error = new Error("failed to serialize input object");
        error.cause = e;
        reportErrorAndQuit(error);
      }
      break;
    default:
      reportErrorAndQuit(new Error("unknown test type"));
  }

  // Check if we can successfully run function under test and report failure if not
  try {
    fn(doc, config.options);
  } catch (e) {
    const error = new Error("operation under test failed");
    error.cause = e;
    reportErrorAndQuit(error);
  }

  // Run warmup iterations
  for (let i = 0; i < config.warmup; i++) {
    fn(doc, config.options);
  }

  const resultsMS = [];
  for (let i = 0; i < config.iterations; i++) {
    let start = performance.now();
    fn(doc, config.options);
    let end = performance.now();
    resultsMS.push(end - start);
  }

  reportResultAndQuit(new BenchmarkResult(resultsMS, size));
}

/**
 * @param message {RunBenchmarkMessage}
 **/
function listener(message) {
  if (message.type === "runBenchmark") {
    const packageSpec = new Package(message.benchmark.library);
    /** @type BSONLib */
    let bson;
    try {
      bson = require(packageSpec.computedModuleName);
    } catch (error) {
      reportErrorAndQuit(error);
    }

    run(bson, message.benchmark);
  } else {
    reportErrorAndQuit(new Error(`unknown ipc message: ${message}`));
  }
}

process.on("message", listener);
