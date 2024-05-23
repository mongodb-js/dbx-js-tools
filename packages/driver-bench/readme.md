# MongoDB Driver benchmark tool

Node.js driver's implementation of the specification benchmarks.
The intention is to keep the benchmarks agonostic of driver version in order to facilitate comparisons.

```sh
env MONGODB_DRIVER_PATH=.../mongodb/lib/index.js node ./lib/cli.mjs
```

## CLI work in progress

### Wishlist

- [ ] Control driver path with CLI flags
- [ ] Request that a version from npm be downloaded and tested
- [ ] Request that a version from git be cloned, built and tested
- [ ] Make comparison easier by renaming output files and pretty printing them
  - [ ] Make comparison _even_ easier by fetching results from EVG.
    - Currently, our results are not made available in a nice way. Predictable S3 URL?
- [ ] Export an API that makes it easy to script running benches against more than one copy of the driver
  - Again in service of comparison: `expect(bench(path)).to.be.faster.than(bench(otherPath))`
