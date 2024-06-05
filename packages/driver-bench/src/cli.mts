#!/usr/bin/env node

import os from 'node:os';
import process from 'node:process';
import util from 'node:util';

import { main } from './driverBench/index.mjs';

const argv = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    grep: { type: 'string', short: 'g', default: '' }
  },
  strict: true,
  allowPositionals: true
});

const [driverPath] = argv.positionals;

console.log(`Benching driver at: ${driverPath}`);

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
console.log(systemInfo());

const mongodbDriver = await import(driverPath);

await main(argv, mongodbDriver);
