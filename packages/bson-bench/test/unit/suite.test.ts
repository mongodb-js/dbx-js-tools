import { expect } from 'chai';
import { readFile } from 'fs/promises';

import { Suite } from '../../lib';
import { exists } from '../../src/utils';

describe('Suite', function () {
  describe('#task()', function () {
    it('returns the Suite it was called on', function () {
      const suite = new Suite('test');
      expect(
        suite.task({
          documentPath: 'test',
          operation: 'serialize',
          warmup: 10,
          iterations: 10,
          library: 'bson@6.0.0',
          options: {}
        })
      ).to.equal(suite);
    });
  });

  describe('#run()', function () {
    it('calls Task.run on all child Tasks', async function () {
      const suite = new Suite('test');
      const benchmark = {
        documentPath: 'test/documents/long_largeArray.json',
        warmup: 10,
        iterations: 10,
        library: 'bson@5.0.0',
        options: {}
      };
      suite
        .task({
          ...benchmark,
          operation: 'serialize'
        })
        .task({
          ...benchmark,
          operation: 'deserialize'
        });

      await suite.run();
      expect(suite.tasks.reduce((acc, task) => acc && task.hasRun, true)).to.be.true;
    });

    context('when called more than once', function () {
      it('throws an error', async function () {
        const suite = new Suite('test');
        const benchmark = {
          documentPath: 'test/documents/long_largeArray.json',
          warmup: 10,
          iterations: 10,
          library: 'bson@5.0.0',
          options: {}
        };
        suite
          .task({
            ...benchmark,
            operation: 'serialize'
          })
          .task({
            ...benchmark,
            operation: 'deserialize'
          });

        expect(await suite.run().catch(e => e)).to.not.be.instanceOf(Error);
        expect(await suite.run().catch(e => e)).to.be.instanceOf(Error);
      });
    });

    it('creates a temp directory for packages', async function () {
      const s = new Suite('test');
      s.task({
        documentPath: 'test/documents/long_largeArray.json',
        library: 'bson@5',
        operation: 'deserialize',
        warmup: 100,
        iterations: 10000,
        options: {}
      });

      const checkForDirectory = async () => {
        for (let i = 0; i < 10; i++) {
          if (await exists(Suite.packageInstallLocation)) return true;
        }
        return false;
      };
      const suiteRunPromise = s.run().catch(e => e);

      const result = await Promise.race([checkForDirectory(), suiteRunPromise]);
      expect(typeof result).to.equal('boolean');
      expect(result).to.be.true;

      const suiteRunResult = await suiteRunPromise;
      expect(suiteRunResult).to.not.be.instanceOf(Error);
    });

    context('after completing successfully', function () {
      it('deletes the temp directory', async function () {
        const s = new Suite('test');
        s.task({
          documentPath: 'test/documents/long_largeArray.json',
          library: 'bson@5',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        const maybeError = await s.run().catch(e => e);
        expect(maybeError).to.not.be.instanceOf(Error);

        const tmpdirExists = await exists(Suite.packageInstallLocation);
        expect(tmpdirExists).to.be.false;
      });
    });

    context('after failing', function () {
      it('deletes the temp directory', async function () {
        const s = new Suite('test');
        s.task({
          documentPath: 'test/documents/array.json',
          library: 'bson@5',
          operation: 'deserialize',
          warmup: 100,
          iterations: 100,
          options: {}
        });

        // bson throws error when passed array as top-level input
        await s.run();

        const tmpdirExists = await exists(Suite.packageInstallLocation);
        expect(tmpdirExists).to.be.false;
      });
    });

    context('when running multiple tasks', function () {
      const counts = { makeInstallLocation: 0, cleanUpInstallLocation: 0 };
      class SuiteCounter extends Suite {
        constructor(n: string) {
          super(n);
        }

        async makeInstallLocation() {
          counts.makeInstallLocation++;
          return await super.makeInstallLocation();
        }

        async cleanUpInstallLocation() {
          counts.cleanUpInstallLocation++;
          return await super.cleanUpInstallLocation();
        }
      }

      let suite: SuiteCounter;
      before(async function () {
        suite = new SuiteCounter('test');
        const benchmark = {
          documentPath: 'test/documents/long_largeArray.json',
          warmup: 10,
          iterations: 10,
          library: 'bson@5.0.0',
          options: {}
        };
        suite
          .task({
            ...benchmark,
            operation: 'serialize'
          })
          .task({
            ...benchmark,
            operation: 'deserialize'
          });

        await suite.run();
      });

      it('creates the tmp directory exactly once', async function () {
        expect(counts.makeInstallLocation).to.equal(1);
      });

      it('deletes the tmp directory exactly once', async function () {
        expect(counts.cleanUpInstallLocation).to.equal(1);
      });
    });
  });

  describe('#writeResults()', function () {
    it('writes all results to the correct file', async function () {
      const suite = new Suite('test');
      const benchmark = {
        documentPath: 'test/documents/long_largeArray.json',
        warmup: 10,
        iterations: 10,
        library: 'bson@5.0.1',
        options: {},
        tags: ['test']
      };
      suite
        .task({
          ...benchmark,
          operation: 'serialize'
        })
        .task({
          ...benchmark,
          operation: 'deserialize'
        });

      await suite.run();
      expect(suite.errors).to.have.lengthOf(0, 'Failed to run benchmarks');
      await suite.writeResults();

      expect(await exists('results.json')).to.be.true;

      const writtenResults = JSON.parse(await readFile('results.json', 'utf8'));
      const results = suite.tasks.map(t => t.getResults());

      expect(Array.isArray(writtenResults)).to.be.true;
      expect(writtenResults.length).to.equal(results.length);

      for (let i = 0; i < writtenResults.length; i++) {
        expect(writtenResults[i]).to.deep.equal(results[i]);
      }
    });
  });
});
