import { expect } from "chai";

import { Package } from "../../lib/common";
import { clearTestedDeps } from "../utils";

describe("common functionality", function () {
  const BSON_PATH = process.env.BSON_PATH;

  context("Package", function () {
    beforeEach(clearTestedDeps);
    afterEach(clearTestedDeps);

    context("constructor()", function () {
      context("when given a correctly formatted npm package", function () {
        it("sets computedModuleName correctly", function () {
          const pack = new Package("bson@6.0.0");
          expect(pack).to.haveOwnProperty("computedModuleName", "bson-6.0.0");
        });
      });

      context("when given a correctly formatted git repository", function () {
        it("sets computedModuleName correctly", function () {
          const pack = new Package(
            "bson#eb98b8c39d6d5ba4ce7231ab9e0f29495d74b994",
          );
          expect(pack).to.haveOwnProperty(
            "computedModuleName",
            "bson-git-eb98b8c39d6d5ba4ce7231ab9e0f29495d74b994",
          );
        });
      });

      context(
        "when trying to install an npm package apart from bson or bson-ext",
        function () {
          it("throws an error", function () {
            expect(() => new Package("notBson@1.0.0")).to.throw(
              Error,
              /unknown package specifier/,
            );
          });
        },
      );

      context(
        "when trying to install a git package apart from bson or bson-ext",
        function () {
          it("throws an error", function () {
            expect(() => new Package("notBson#abcdabcdabcd")).to.throw(
              Error,
              /unknown package specifier/,
            );
          });
        },
      );

      context("when given a local package", function () {
        it("sets computedModuleName correctly");
      });
    });

    context("#check()", function () {
      context("when package is not installed", function () {
        it("returns undefined", function () {});
      });

      context("when package is installed", function () {
        it("returns the module");
      });
    });

    context("#install()", function () {
      context(
        "when given a correctly formatted npm package that exists",
        function () {
          for (const lib of ["bson@6.0.0", "bson-ext@4.0.0"]) {
            it(`installs ${lib} successfully`, async function () {
              const pack = new Package(lib);
              await pack.install();
            });
          }
        },
      );

      context(
        "when given a correctly formatted npm package that does not exist",
        function () {
          it("throws an error", async function () {
            const bson9000 = new Package("bson@9000");
            const error = await bson9000.install().catch((error) => error);
            expect(error).to.be.instanceOf(Error);
          });
        },
      );

      context(
        "when given a correctly formatted git package using commit that exists",
        function () {
          it("installs successfully", async function () {
            const bson6Git = new Package("bson#58c002d");
            const maybeError = await bson6Git.install().catch((error) => error);
            expect(maybeError).to.be.undefined;
          });
        },
      );

      context(
        "when given a correctly formatted git package using commit that does not exist",
        function () {
          it("throws an error", async function () {
            const bson6Git = new Package(
              "bson#58c002d87bca9bbe7c7001cc6acae54e90a951bcf",
            );
            const maybeError = await bson6Git.install().catch((error) => error);
            expect(maybeError).to.be.instanceOf(Error);
          });
        },
      );

      context(
        "when given a correctly formatted git package using git tag that exists",
        function () {
          it("installs successfully", async function () {
            const bson6Git = new Package("bson#v6.0.0");
            const maybeError = await bson6Git.install().catch((error) => error);
            expect(maybeError).to.be.undefined;
          });
        },
      );

      context(
        "when given a correctly formatted git package using git tag that does not exist",
        function () {
          it("throws an error", async function () {
            const bson6Git = new Package("bson#v999.999.9");
            const maybeError = await bson6Git.install().catch((error) => error);
            expect(maybeError).to.be.instanceOf(Error);
          });
        },
      );

      context("when given a path that exists", function () {
        it("installs successfully", async function () {
          if (!BSON_PATH) {
            console.log(
              "Skipping test since BSON_PATH env variable not defined",
            );
            this.skip();
          }

          const bsonLocal = new Package(`bson:${BSON_PATH}`);
          const maybeError = await bsonLocal.install().catch((error) => error);
          expect(maybeError).to.be.undefined;
        });
      });

      context("when given a path that does not exist", function () {
        it("throws an error", async function () {
          const bsonLocal = new Package(
            `bson:/highly/unlikely/path/to/exist/that/should/point/to/bson`,
          );
          const maybeError = await bsonLocal.install().catch((error) => error);
          expect(maybeError).to.be.instanceOf(Error);
        });
      });
    });
  });
});
