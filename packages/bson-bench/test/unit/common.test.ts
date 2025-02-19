import { expect } from 'chai';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, sep } from 'path';

import { Package } from '../../lib/common';
import { clearTestedDeps, exists } from '../utils';

describe('common functionality', function () {
  const BSON_PATH = process.env.BSON_PATH;

  context('Package', function () {
    let installDir: string;

    after(async function () {
      await rm(installDir, { recursive: true, force: true });
    });

    beforeEach(async function () {
      await clearTestedDeps(installDir);
    });

    before(async function () {
      installDir = join(tmpdir(), 'bsonBenchTest');
      await mkdir(installDir);
    });

    context('constructor()', function () {
      //github.com/mongodb-js/dbx-js-tools/pull/24/files
      context('when given a correctly formatted npm package', function () {
        it('sets computedModuleName correctly', function () {
          const pack = new Package('bson@6.0.0', installDir);
          expect(pack).to.haveOwnProperty('computedModuleName', 'bson-6.0.0');
        });
      });

      context('when given a correctly formatted git repository', function () {
        it('sets computedModuleName correctly', function () {
          const pack = new Package('bson#eb98b8c39d6d5ba4ce7231ab9e0f29495d74b994', installDir);
          expect(pack).to.haveOwnProperty(
            'computedModuleName',
            'bson-git-eb98b8c39d6d5ba4ce7231ab9e0f29495d74b994'
          );
        });
      });

      context('when trying to install an npm package apart from bson or bson-ext', function () {
        it('throws an error', function () {
          expect(() => new Package('notBson@1.0.0', installDir)).to.throw(
            Error,
            /unknown package specifier/
          );
        });
      });

      context('when trying to install a git package apart from bson or bson-ext', function () {
        it('throws an error', function () {
          expect(() => new Package('notBson#abcdabcdabcd', installDir)).to.throw(
            Error,
            /unknown package specifier/
          );
        });
      });

      context('when given a local package', function () {
        it('sets computedModuleName correctly', function () {
          if (!BSON_PATH) {
            console.log('Skipping since BSON_PATH is undefined');
            this.skip();
          }
          const pack = new Package(`bson:${BSON_PATH}`, installDir);
          expect(pack).to.haveOwnProperty(
            'computedModuleName',
            `bson-local-${BSON_PATH.replaceAll(sep, '_')}`
          );
        });
      });
    });

    context('#check()', function () {
      context('when package is not installed', function () {
        it('returns undefined', function () {
          const pack = new Package('bson@6', installDir);
          expect(pack.check()).to.be.undefined;
        });
      });

      context('when package is installed', function () {
        it('returns the module', async function () {
          const pack = new Package('bson@6.0.0', installDir);
          await pack.install();
          expect(pack.check()).to.not.be.undefined;
        });
      });
    });

    context('#install()', function () {
      context('when given a correctly formatted npm package that exists', function () {
        for (const lib of ['bson@6.0.0', 'bson-ext@4.0.0', 'bson@latest', 'bson-ext@latest']) {
          it(`installs ${lib} successfully to the specified install directory`, async function () {
            const pack = new Package(lib, installDir);
            await pack.install();

            expect(await exists(join(installDir, 'node_modules', pack.computedModuleName))).to.be
              .true;
          });
        }
      });

      context('when given a correctly formatted npm package that does not exist', function () {
        it('throws an error', async function () {
          const bson9000 = new Package('bson@9000', installDir);
          const error = await bson9000.install().catch(error => error);
          expect(error).to.be.instanceOf(Error);
        });
      });

      context('when given a correctly formatted git package using commit that exists', function () {
        it('installs successfully to specified install directory', async function () {
          const bson6Git = new Package('bson#58c002d', installDir);
          const maybeError = await bson6Git.install().catch(error => error);
          expect(maybeError).to.be.undefined;
          expect(await exists(join(installDir, 'node_modules', bson6Git.computedModuleName))).to.be
            .true;
        });
      });

      context(
        'when given a correctly formatted git package using commit that does not exist',
        function () {
          // TODO: NODE-6361: Unskip and fix this test.
          it.skip('throws an error', async function () {
            const bson6Git = new Package(
              'bson#58c002d87bca9bbe7c7001cc6acae54e90a951bcf',
              installDir
            );
            const maybeError = await bson6Git.install().catch(error => error);
            expect(maybeError).to.be.instanceOf(Error);
          });
        }
      );

      context(
        'when given a correctly formatted git package using git tag that exists',
        function () {
          it('installs successfully', async function () {
            const bson6Git = new Package('bson#v6.0.0', installDir);
            const maybeError = await bson6Git.install().catch(error => error);
            expect(maybeError).to.be.undefined;
            expect(await exists(join(installDir, 'node_modules', bson6Git.computedModuleName))).to
              .be.true;
          });
        }
      );

      context(
        'when given a correctly formatted git package using git tag that does not exist',
        function () {
          it('throws an error', async function () {
            const bson6Git = new Package('bson#v999.999.9', installDir);
            const maybeError = await bson6Git.install().catch(error => error);
            expect(maybeError).to.be.instanceOf(Error);
          });
        }
      );

      context('when given a path that exists', function () {
        it('installs successfully', async function () {
          if (!BSON_PATH) {
            console.log('Skipping test since BSON_PATH env variable not defined');
            this.skip();
          }

          const bsonLocal = new Package(`bson:${BSON_PATH}`, installDir);
          const maybeError = await bsonLocal.install().catch(error => error);
          expect(maybeError).to.not.be.instanceOf(Error, maybeError.message);
          expect(await exists(join(installDir, 'node_modules', bsonLocal.computedModuleName))).to.be
            .true;
        });
      });

      context('when given a path that does not exist', function () {
        it('throws an error', async function () {
          const bsonLocal = new Package(
            `bson:/highly/unlikely/path/to/exist/that/should/point/to/bson`,
            installDir
          );
          const maybeError = await bsonLocal.install().catch(error => error);
          expect(maybeError).to.be.instanceOf(Error);
        });
      });
    });
  });
});
