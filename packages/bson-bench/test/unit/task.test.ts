import { expect } from 'chai';
import { rm } from 'fs/promises';
import * as path from 'path';

import { Task } from '../../lib/task';
import { type BenchmarkSpecification, type PerfSendResult } from '../../src/common';
import { exists } from '../../src/utils';
import { clearTestedDeps } from '../utils';

const LOCAL_BSON = path.join(__dirname, '..', '..', 'node_modules', 'bson');

describe('Task', function () {
  beforeEach(async function () {
    await clearTestedDeps(Task.packageInstallLocation);
  });

  after(async function () {
    await clearTestedDeps(Task.packageInstallLocation);
  });

  const BSON_PATH = process.env.BSON_PATH;
  const BSON_EXT_PATH = process.env.BSON_EXT_PATH;
  const versions = [
    'bson@6.2.0',
    'bson@4.0.0',
    'bson@1.1.6',
    'bson@5.0.0',
    'bson#v6.1.0',
    `bson:${LOCAL_BSON}`,
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
          options: {},
          tags: ['test']
        }
      ];
    })
  );

  context('#run()', function () {
    for (const test of testTable) {
      context(`${test.operation} with library specifier: ${test.library}`, function () {
        let task;

        beforeEach(function () {
          task = new Task(test);
        });

        it('completes successfully', async function () {
          if (
            Number(process.versions.node.split('.')[0]) >= 20 &&
            /bson-ext#.*/.test(test.library)
          ) {
            console.log('Skipping installing bson-ext via git tag on Node 20');
            this.skip();
          }

          await task.run();
          for (const child of task.children) {
            expect(child.exitCode).to.not.be.null;
            expect(child.exitCode).to.equal(0);
          }
        });

        it('strips the tag or commit from the test name', function () {
          expect(task.testName).to.not.include(test.library);
          expect(task.testName).to.match(/bson|bson-ext/);
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
          library: 'bson@5',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        // bson throws error when passed array as top-level input
        const maybeError = await task.run().catch(e => e);

        expect(maybeError).to.be.instanceOf(Error);
        expect(maybeError).to.have.property('message', 'failed to serialize input object');
      });

      it('deletes the temp directory', async function () {
        const task = new Task({
          documentPath: 'test/documents/array.json',
          library: 'bson@5',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        // bson throws error when passed array as top-level input
        const maybeError = await task.run().catch(e => e);

        expect(maybeError).to.be.instanceOf(Error);
        expect(maybeError).to.have.property('message', 'failed to serialize input object');

        const tmpdirExists = await exists(Task.packageInstallLocation);
        expect(tmpdirExists).to.be.false;
      });
    });

    it('creates a temp directory for packages', async function () {
      const task = new Task({
        documentPath: 'test/documents/long_largeArray.json',
        library: 'bson@5',
        operation: 'deserialize',
        warmup: 100,
        iterations: 10000,
        options: {}
      });

      const checkForDirectory = async () => {
        for (let i = 0; i < 10; i++) {
          if (await exists(Task.packageInstallLocation)) return true;
        }
        return false;
      };
      const taskRunPromise = task.run().catch(e => e);

      const result = await Promise.race([checkForDirectory(), taskRunPromise]);
      expect(typeof result).to.equal('boolean');
      expect(result).to.be.true;

      const taskRunResult = await taskRunPromise;
      expect(taskRunResult).to.not.be.instanceOf(Error);
    });

    context('after completing successfully', function () {
      it('deletes the temp directory', async function () {
        const task = new Task({
          documentPath: 'test/documents/long_largeArray.json',
          library: 'bson@5',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        const maybeError = await task.run().catch(e => e);
        expect(maybeError).to.not.be.instanceOf(Error);

        const tmpdirExists = await exists(Task.packageInstallLocation);
        expect(tmpdirExists).to.be.false;
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
        index: 0,
        validation: { utf8: false }
      };

      task = new Task({
        documentPath: 'test/documents/long_largeArray.json',
        library: 'bson@4.0.0',
        operation: 'deserialize',
        warmup: 1,
        iterations: 1,
        options,
        tags: ['test', 'test2']
      });

      task.result = {
        durationMillis: Array.from({ length: 1000 }, () => 100),
        documentSizeBytes: 100
      };
      task.hasRun = true;
      results = task.getResults();
    });

    it('returns results as an object', async function () {
      expect(results.info).to.haveOwnProperty('test_name', task.testName);
      expect(results.info).to.haveOwnProperty('args');
    });

    it('returns the tags in the info.tags field', function () {
      expect(results.info.tags).to.deep.equal(['test', 'test2']);
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

    describe('when utf8 validation is enabled', function () {
      const options = {
        validation: { utf8: true }
      };

      let results: PerfSendResult;

      before(() => {
        const task = new Task({
          documentPath: 'test/documents/long_largeArray.json',
          library: 'bson@4.0.0',
          operation: 'deserialize',
          warmup: 1,
          iterations: 1,
          options
        });
        task.result = {
          durationMillis: Array.from({ length: 1000 }, () => 100),
          documentSizeBytes: 100
        };
        task.hasRun = true;
        results = task.getResults();
      });

      it('info.args.utf8Validation is 1', function () {
        expect(results.info.args).to.haveOwnProperty('utf8Validation', 1);
      });
    });

    describe('when utf8Validation is disabled', function () {
      const options = {
        validation: { utf8: false }
      };

      let results: PerfSendResult;

      before(() => {
        const task = new Task({
          documentPath: 'test/documents/long_largeArray.json',
          library: 'bson@4.0.0',
          operation: 'deserialize',
          warmup: 1,
          iterations: 1,
          options
        });
        task.result = {
          durationMillis: Array.from({ length: 1000 }, () => 100),
          documentSizeBytes: 100
        };
        task.hasRun = true;
        results = task.getResults();
      });

      it('info.args.utf8Validation is 0', function () {
        expect(results.info.args).to.haveOwnProperty('utf8Validation', 0);
      });
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

      expectedFileName = `${task.testName}.json`;
      if (await exists(expectedFileName)) await rm(expectedFileName);
    });

    after(async () => {
      expectedFileName = `${task.testName}.json`;
      if (await exists(expectedFileName)) await rm(expectedFileName);
    });

    it('writes to the correct file', async function () {
      await task.run();
      await task.writeResults();

      expect(await exists(expectedFileName)).to.be.true;
    });
  });
});
