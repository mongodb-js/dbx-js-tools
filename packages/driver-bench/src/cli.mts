#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process'
import module from 'node:module';
import child_process from 'node:child_process';
import events from 'node:events';

let require;

let { MONGODB_DRIVER_PATH = '', DEBUG_BENCH = 'no' } = process.env

if (MONGODB_DRIVER_PATH === '') {
  require ??= module.createRequire(import.meta.dirname);
  MONGODB_DRIVER_PATH = require.resolve('mongodb')
}

const benchmark = child_process.fork(
    path.join(import.meta.dirname, './driverBench/index.mjs'),
    {
      execArgv: DEBUG_BENCH == 'yes' ? ['--enable-source-maps'] : [],
      stdio: 'inherit',
      env: { MONGODB_DRIVER_PATH }
    }
);
await events.once(benchmark, 'exit');
