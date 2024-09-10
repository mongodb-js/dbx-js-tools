import fs from 'node:fs';
import stream from 'node:stream/promises';

import * as csv from 'csv';

const NUM_HEADERS = ['base_mean', 'compare_mean', 'percent_change'];
const HEADERS = ['task', 'test', 'measurement', ...NUM_HEADERS];

await stream.pipeline(
  fs.createReadStream('./data/Data.csv', 'utf8'),
  csv.parse({ columns: true }),
  csv.transform(record =>
    Object.fromEntries(
      Object.entries(record)
        .filter(([header]) => HEADERS.includes(header))
        .map(([header, value]) => [header, NUM_HEADERS.includes(header) ? Number(value) : value])
    )
  ),
  async (source: csv.transformer.Transformer) =>
    console.table((await source.toArray()).toSorted((a, b) => a.percent_change - b.percent_change))
);
