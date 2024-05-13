'use strict';

const MINUTE_TO_MS = 60 * 1e3;
const FIVE_MINUTES_TO_MS = MINUTE_TO_MS * 5;

export const DEFAULT_MIN_EXECUTION_TIME =
  Number.parseInt(process.env.DRIVER_BENCH_MIN_EX_TIME, 10) || MINUTE_TO_MS;

export const DEFAULT_MAX_EXECUTION_TIME =
  Number.parseInt(process.env.DRIVER_BENCH_MAX_EX_TIME, 10) || FIVE_MINUTES_TO_MS;

export const DEFAULT_MIN_EXECUTION_COUNT =
  Number.parseInt(process.env.DRIVER_BENCH_MIN_EX_COUNT, 10) || 100;
