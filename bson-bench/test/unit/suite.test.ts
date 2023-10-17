import { expect } from "chai";

import { Suite } from "../../lib";
import { clearTestedDeps } from "../utils";

describe("Suite", function () {
  beforeEach(clearTestedDeps);
  afterEach(clearTestedDeps);

  describe("#constructor()", function () {});
  describe("#task()", function () {
    it("returns the Suite it was called on", function () {
      const suite = new Suite("test");
      expect(
        suite.task({
          documentPath: "test",
          operation: "serialize",
          warmup: 10,
          iterations: 10,
          library: "bson@6.0.0",
          options: {},
        }),
      ).to.equal(suite);
    });
  });
  describe("#run()", function () {
    it("calls Task.run on all child Tasks", async function () {
      const suite = new Suite("test");
      const benchmark = {
        documentPath: "test/documetns/long_largeArray.json",
        warmup: 10,
        iterations: 10,
        library: "bson@6.0.0",
        options: {},
      };
      suite
        .task({
          ...benchmark,
          operation: "serialize",
        })
        .task({
          ...benchmark,
          operation: "deserialize",
        });

      await suite.run();
      expect(suite.tasks.reduce((acc, task) => acc && task.hasRun, true)).to.be
        .true;
    });
  });
  describe("#writeResults()", function () {});
});
