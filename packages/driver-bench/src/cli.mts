#!/usr/bin/env node

import os from 'node:os';
import process from 'node:process';
import util from 'node:util';

import { main } from './driverBench/index.mjs';

const argv = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    grep: { type: 'string', short: 'g', default: '' },
    help: { type: 'boolean', short: 'h', default: false }
  },
  strict: true,
  allowPositionals: true
});

const [driverPath] = argv.positionals;

if (argv.values.help || driverPath == null || driverPath.length === 0) {
  console.error('node cli.mjs DRIVER_PATH [--grep/-g BENCHMARK_NAME]');
  process.exit(0);
}

const hw = os.cpus();
const ram = os.totalmem() / 1024 ** 3;
const platform = { name: hw[0].model, cores: hw.length, ram: `${ram}GB` };

const systemInfo = () =>
  [
    `\n- cpu: ${platform.name}`,
    `- cores: ${platform.cores}`,
    `- arch: ${os.arch()}`,
    `- os: ${process.platform} (${os.release()})`,
    `- ram: ${platform.ram}\n`
  ].join('\n');

const mongodbDriver = await import(driverPath);

let { MONGODB_URI = '' } = process.env;
MONGODB_URI = MONGODB_URI.length === 0 ? 'mongodb://127.0.0.1:27017' : MONGODB_URI;

const client = new mongodbDriver.MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
try {
  console.log('server version:', (await client.db('admin').command({ buildInfo: 1 })).version);
  await client.close();
  console.log(`Benching driver at: ${driverPath}`);
  console.log(systemInfo());
  await main(argv, mongodbDriver);
} catch (error) {
  await client.close();
  console.log('Unable to benchmark against:\n', MONGODB_URI, '\n', error);
}
