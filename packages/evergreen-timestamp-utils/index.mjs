#!/usr/bin/env node

import { pipeline } from 'stream/promises';

async function* lines(generator) {
  let data = '';

  for await (const chunk of generator) {
    data += chunk;
  }

  yield* data.split('\n');
}

async function* removeEmptyLines(generator) {
  for await (const chunk of generator) {
    if (chunk.length) yield chunk;
  }
}

async function* removeTimestamp(generator) {
  for await (const line of generator) {
    const timestamp = /\[.*\](?<rest>.*)/;
    const {
      groups: { rest }
    } = line.match(timestamp) ?? { groups: { rest: line } };
    yield rest;
  }
}

async function* addNewlines(generator) {
  for await (const item of generator) {
    yield item;
    yield '\n';
  }
}

await pipeline(
  process.stdin,
  lines,
  removeEmptyLines,
  removeTimestamp,
  addNewlines,
  process.stdout
);
