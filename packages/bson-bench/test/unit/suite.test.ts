import { expect } from "chai";
import { readFile } from "fs/promises";

import { Suite } from "../../lib";
import { exists } from "../../src/utils";
import { clearTestedDeps } from "../utils";

describe("Suite", function () {
  beforeEach(clearTestedDeps);
  after(clearTestedDeps);

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
        documentPath: "test/documents/long_largeArray.json",
        warmup: 10,
        iterations: 10,
        library: "bson@5.0.0",
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

    context("when called more than once", function () {
      it("throws an error", async function () {
        const suite = new Suite("test");
        const benchmark = {
          documentPath: "test/documents/long_largeArray.json",
          warmup: 10,
          iterations: 10,
          library: "bson@5.0.0",
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

        expect(await suite.run().catch((e) => e)).to.not.be.instanceOf(Error);
        expect(await suite.run().catch((e) => e)).to.be.instanceOf(Error);
      });
    });
  });

  describe("#writeResults()", function () {
    it("writes all results to the correct file", async function () {
      const suite = new Suite("test");
      const benchmark = {
        documentPath: "test/documents/long_largeArray.json",
        warmup: 10,
        iterations: 10,
        library: "bson@5.0.0",
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
      expect(suite.errors).to.have.lengthOf(0, "Failed to run benchmarks");
      await suite.writeResults();

      expect(await exists("results.json")).to.be.true;

      const writtenResults = JSON.parse(await readFile("results.json", "utf8"));
      const results = suite.tasks.map((t) => t.getResults());

      expect(Array.isArray(writtenResults)).to.be.true;
      expect(writtenResults.length).to.equal(results.length);

      for (let i = 0; i < writtenResults.length; i++) {
        expect(writtenResults[i]).to.deep.equal(results[i]);
      }
    });
  });
});
