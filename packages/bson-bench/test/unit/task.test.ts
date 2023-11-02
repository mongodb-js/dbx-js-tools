import { expect } from 'chai';
import { rm } from 'fs/promises';

import { Task } from '../../lib/task';
import { type BenchmarkSpecification, type PerfSendResult } from '../../src/common';
import { exists } from '../../src/utils';
import { clearTestedDeps } from '../utils';

describe('Task', function () {
  beforeEach(clearTestedDeps);
  after(clearTestedDeps);

  const BSON_PATH = process.env.BSON_PATH;
  const BSON_EXT_PATH = process.env.BSON_EXT_PATH;
  const versions = [
    'bson@4.0.0',
    'bson@5.0.0',
    'bson@6.0.0',
    'bson#v6.1.0',
    'bson-ext@4.0.0',
    'bson-ext#c1284d1'
  ];
  const operations: ('serialize' | 'deserialize')[] = ['serialize', 'deserialize'];
  if (BSON_PATH) versions.push(`bson:${BSON_PATH}`);
  if (BSON_EXT_PATH) versions.push(`bson:${BSON_EXT_PATH}`);
  const testTable: BenchmarkSpecification[] = versions.flatMap(library =>
    operations.flatMap(operation => {
      return [
        {
          documentPath: 'test/documents/long_largeArray.json',
          library,
          operation,
          warmup: 100,
          iterations: 100,
          options: {}
        }
      ];
    })
  );

  context('#run()', function () {
    for (const test of testTable) {
      context(`${test.operation} with library specifier: ${test.library}`, function () {
        it('completes successfully', async function () {
          const task = new Task(test);

          await task.run();
          for (const child of task.children) {
            expect(child.exitCode).to.not.be.null;
            expect(child.exitCode).to.equal(0);
          }
        });
      });
    }

    context('when benchmark file does not exist', function () {
      it('throws an error', async function () {
        const task = new Task({
          documentPath: 'nonexistent/test/document.json',
          library: 'bson@6.0.0',
          operation: 'serialize',
          warmup: 1,
          iterations: 1,
          options: {}
        });

        expect(await task.run().catch(e => e)).to.be.instanceOf(
          Error,
          'Failed to read test document'
        );
      });
    });

    context('when benchmark throws error', function () {
      it('throws error', async function () {
        const task = new Task({
          documentPath: 'test/documents/array.json',
          library: 'bson-ext@4.0.0',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        const maybeError = await task.run().catch(e => e);

        expect(maybeError).to.be.instanceOf(Error, 'failed to serialize input object');
      });
    });
  });

  context('#getResults()', function () {
    let task: Task;
    let results: PerfSendResult;

    before(async function () {
      const options = {
        promoteValues: true,
        promoteBuffers: true,
        promoteLongs: true,
        bsonRegExp: true,
        allowObjectSmallerThanBufferSize: false,
        useBigInt64: true,
        evalFunctions: false,
        cacheFunctions: false,
        checkKeys: true,
        ignoreUndefined: false,
        serializeFunctions: false,
        index: 0
      };

      task = new Task({
        documentPath: 'test/documents/long_largeArray.json',
        library: 'bson-ext@4.0.0',
        operation: 'deserialize',
        warmup: 1,
        iterations: 1,
        options
      });

      await task.run();

      results = task.getResults();
    });

    it('returns results as an object', async function () {
      expect(results.info).to.haveOwnProperty('test_name', task.taskName);
      expect(results.info).to.haveOwnProperty('args');
    });

    it('returns options provided in constructor in the info.args field', function () {
      expect(results.info.args).to.haveOwnProperty('warmup');
      expect(results.info.args).to.haveOwnProperty('iterations');

      expect(results.info.args).to.haveOwnProperty('promoteLongs', 1);
    });

    it('returns boolean options provided in constructor as numeric options in the info.args field', function () {
      expect(results.info.args).to.haveOwnProperty('promoteLongs', 1);
      expect(results.info.args).to.haveOwnProperty('promoteBuffers', 1);
      expect(results.info.args).to.haveOwnProperty('promoteValues', 1);
      expect(results.info.args).to.haveOwnProperty('bsonRegExp', 1);
      expect(results.info.args).to.haveOwnProperty('allowObjectSmallerThanBufferSize', 0);
      expect(results.info.args).to.haveOwnProperty('useBigInt64', 1);
      expect(results.info.args).to.haveOwnProperty('evalFunctions', 0);
      expect(results.info.args).to.haveOwnProperty('cacheFunctions', 0);
      expect(results.info.args).to.haveOwnProperty('checkKeys', 1);
      expect(results.info.args).to.haveOwnProperty('ignoreUndefined', 0);
      expect(results.info.args).to.haveOwnProperty('serializeFunctions', 0);
    });

    it('returns numeric options provided in constructor as provided in the info.args field', function () {
      expect(results.info.args).to.haveOwnProperty('index', 0);
    });
  });

  context('#writeResults()', function () {
    let task: Task;
    let expectedFileName: string;

    before(async () => {
      task = new Task({
        documentPath: 'test/documents/long_largeArray.json',
        library: 'bson-ext@4.0.0',
        operation: 'deserialize',
        warmup: 100,
        iterations: 100,
        options: { promoteLongs: true }
      });

      expectedFileName = `${task.taskName}.json`;
      if (await exists(expectedFileName)) await rm(expectedFileName);
    });

    after(async () => {
      expectedFileName = `${task.taskName}.json`;
      if (await exists(expectedFileName)) await rm(expectedFileName);
    });

    it('writes to the correct file', async function () {
      await task.run();
      await task.writeResults();

      expect(await exists(expectedFileName)).to.be.true;
    });
  });
});
