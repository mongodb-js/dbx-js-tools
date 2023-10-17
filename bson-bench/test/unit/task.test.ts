import { expect } from "chai";

import { type BenchmarkSpecification, Task } from "../../lib";
import { clearTestedDeps } from "../utils";

describe("Task", function () {
  beforeEach(clearTestedDeps);
  afterEach(clearTestedDeps);

  const BSON_PATH = process.env.BSON_PATH;
  const BSON_EXT_PATH = process.env.BSON_EXT_PATH;
  const versions = [
    "bson@4.0.0",
    "bson@5.0.0",
    "bson@6.0.0",
    "bson#v6.1.0",
    "bson-ext@4.0.0",
    "bson-ext#c1284d1",
  ];
  const operations: ("serialize" | "deserialize")[] = [
    "serialize",
    "deserialize",
  ];
  if (BSON_PATH) versions.push(`bson:${BSON_PATH}`);
  if (BSON_EXT_PATH) versions.push(`bson:${BSON_EXT_PATH}`);
  const testTable: BenchmarkSpecification[] = versions.flatMap((library) =>
    operations.flatMap((operation) => {
      return [
        {
          documentPath: "test/documents/long_largeArray.json",
          library,
          operation,
          warmup: 100,
          iterations: 100,
          options: {},
        },
      ];
    }),
  );

  context("#run()", function () {
    for (const test of testTable) {
      context(
        `${test.operation} with library specifier: ${test.library}`,
        function () {
          it("completes successfully", async function () {
            const task = new Task(test);

            await task.run();
            for (const child of task.children) {
              expect(child.exitCode).to.not.be.null;
            }
          });
        },
      );
    }

    context("when benchmark throws error", function () {
      it("throws error");
    });
  });

  context("#writeResults()", function () {
    it("writes to correct file");
  });
});
