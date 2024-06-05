import { writeFile } from 'node:fs/promises';
import util from 'node:util';

import { Runner } from '../mongoBench/index.mjs';
import {
  makeMultiBench,
  makeParallelBenchmarks,
  makeSingleBench
} from '../mongoBench/suites/index.mjs';

function average(arr: number[]) {
  return arr.reduce((x, y) => x + y, 0) / arr.length;
}

// TODO(NODE-4606): test against different driver configurations in CI
export async function main(
  argv: { values: { grep: string } },
  mongodbDriver: { MongoClient; GridFSBucket }
) {
  const benchmarkRunner = new Runner(argv.values)
    .suite('singleBench', suite => makeSingleBench(suite, mongodbDriver))
    .suite('multiBench', suite => makeMultiBench(suite, mongodbDriver))
    .suite('parallel', suite => makeParallelBenchmarks(suite, mongodbDriver));

  const microBench = await benchmarkRunner.run();

  const singleBench = average([
    microBench.singleBench.findOne,
    microBench.singleBench.smallDocInsertOne,
    microBench.singleBench.largeDocInsertOne
  ]);
  const multiBench = average(Object.values(microBench.multiBench));

  const parallelBench = average([
    microBench.parallel.ldjsonMultiFileUpload,
    microBench.parallel.ldjsonMultiFileExport,
    microBench.parallel.gridfsMultiFileUpload,
    microBench.parallel.gridfsMultiFileDownload
  ]);

  const readBench = average([
    microBench.singleBench.findOne,
    microBench.multiBench.findManyAndEmptyCursor,
    microBench.multiBench.gridFsDownload,
    microBench.parallel.gridfsMultiFileDownload,
    microBench.parallel.ldjsonMultiFileExport
  ]);
  const writeBench = average([
    microBench.singleBench.smallDocInsertOne,
    microBench.singleBench.largeDocInsertOne,
    microBench.multiBench.smallDocBulkInsert,
    microBench.multiBench.largeDocBulkInsert,
    microBench.multiBench.gridFsUpload,
    microBench.parallel.ldjsonMultiFileUpload,
    microBench.parallel.gridfsMultiFileUpload
  ]);

  const driverBench = average([readBench, writeBench]);

  const benchmarkResults = {
    singleBench,
    multiBench,
    parallelBench,
    readBench,
    writeBench,
    driverBench,
    ...microBench.parallel,
    ...microBench.bsonBench,
    ...microBench.singleBench,
    ...microBench.multiBench
  };

  const data = Object.entries(benchmarkResults).map(([benchmarkName, result]) => ({
    info: { test_name: benchmarkName, tags: ['js-bson'] },
    metrics: [{ name: 'megabytes_per_second', value: result }]
  }));

  const results = JSON.stringify(data, undefined, 2);
  console.log(util.inspect(data, { depth: Infinity, colors: true }));
  await writeFile('results.json', results);
}
