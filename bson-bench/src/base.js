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
function sendResult(result) {
  if (process.send) process?.send({ type: "returnResult", result });
}

/**
 * @param error {Error}
 */
function sendError(error) {
  if (process.send) process.send({ type: "returnError", error });
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
      size = BSON.serialize(doc).length;
      break;
    case "deserialize":
      fn = bson.deserialize;
      doc = BSON.serialize(doc);
      size = doc.length;
      break;
    default:
      sendError(new Error("unknown test type"));
      process.exit(1);
  }

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

  sendResult(new BenchmarkResult(resultsMS, size));

  process.disconnect();
  process.exit(0);
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
      sendError(error);
      process.disconnect();
      process.exit(1);
    }

    run(bson, message.benchmark);
  } else {
    sendError(new Error(`unknown ipc message: ${message}`));
    process.disconnect();
    process.exit(1);
  }
}

process.on("message", listener);
