import * as cp from 'child_process';
import { once } from 'events';
import { join, sep } from 'path';

import { exists } from './utils';

// handle normal npm package regex
export const NPM_PACKAGE_REGEX = /(bson-ext|bson)@((\d+(\.\d+)?(\.\d+)?)|latest)/;
// handle git tags/commits
export const GIT_PACKAGE_REGEX = /(bson-ext|bson)#(.+)/;
// handle local package
export const LOCAL_PACKAGE_REGEX = /(bson-ext|bson):(.+)/;

/**
 * The Package class represents the bson or bson-ext package to be tested
 * This package can be an npm package, a git repository or a local package
 **/
export class Package {
  type: 'npm' | 'git' | 'local';
  // bson library to install
  library: 'bson' | 'bson-ext';
  computedModuleName: string;
  // semver version specification
  npmVersion?: string;
  // git commit hash or tag
  gitCommitish?: string;
  // path to local library
  localPath?: string;
  installPath: string;

  constructor(libSpec: string, installPath: string) {
    this.installPath = installPath;
    let match: RegExpExecArray | null;
    if ((match = NPM_PACKAGE_REGEX.exec(libSpec))) {
      this.type = 'npm';
      this.library = match[1] as 'bson' | 'bson-ext';
      this.npmVersion = match[2];
      this.computedModuleName = `${this.library}-${this.npmVersion}`;
    } else if ((match = GIT_PACKAGE_REGEX.exec(libSpec))) {
      this.type = 'git';
      this.library = match[1] as 'bson' | 'bson-ext';
      this.gitCommitish = match[2];
      this.computedModuleName = `${this.library}-git-${this.gitCommitish}`;
    } else if ((match = LOCAL_PACKAGE_REGEX.exec(libSpec))) {
      this.type = 'local';
      this.library = match[1] as 'bson' | 'bson-ext';

      this.localPath = match[2];
      this.computedModuleName = `${this.library}-local-${this.localPath.replaceAll(sep, '_')}`;
    } else {
      throw new Error('unknown package specifier');
    }
  }

  /**
   * returns the package if it exists, otherwise return undefined
   */
  check<B extends BSONLib>(): B | undefined {
    try {
      return require(join(this.installPath, 'node_modules', this.computedModuleName));
    } catch {
      return undefined;
    }
  }

  /**
   * Installs the package using the npm cli
   *
   * Note that this function should not be run in the same Node process that imports the installed
   * module
   **/
  async install(): Promise<void> {
    let source: string;
    switch (this.type) {
      case 'npm':
        source = `npm:${this.library}@${this.npmVersion}`;
        break;
      case 'git':
        switch (this.library) {
          case 'bson':
            source = `git://github.com/mongodb/js-bson#${this.gitCommitish}`;
            break;
          case 'bson-ext':
            source = `git://github.com/mongodb-js/bson-ext#${this.gitCommitish}`;
            break;
        }
        break;
      case 'local':
        source = `${this.localPath}`;
        // Check if path exists as npm install will not throw an error if this is not the case
        if (!(await exists(source))) throw new Error(`'${source}' not found`);
        break;
    }

    const npmInstallProcess = cp.exec(`npm install ${this.computedModuleName}@${source}`, {
      encoding: 'utf8',
      cwd: this.installPath
    });

    const exitCode: number = (await once(npmInstallProcess, 'exit'))[0];
    if (exitCode !== 0) {
      throw new Error(`unable to install module: ${this.computedModuleName}@${source}`);
    }
  }
}

export interface Document {
  [key: string]: any;
}

export interface BSONLib {
  deserialize: (b: Uint8Array, options?: any) => Document;
  serialize: (o: Document, options?: any) => Uint8Array;
  EJSON?: any;
}

export interface ConstructibleBSON {
  new (): BSONLib;
}

export type BenchmarkSpecification = {
  /** Path to test document */
  documentPath: string;
  /** BSON operation to be benchmarked */
  operation: 'serialize' | 'deserialize';
  /** Options to be passed in to the operation being performed */
  options: Record<string, any>;
  /** Number of iterations that will be timed and used to calculate summary statistics*/
  iterations: number;
  /** Number of iterations that will be run to warm up the V8 engine */
  warmup: number;
  /** Specifier of the bson or bson-ext library to be used. Can be an npm package, git repository or
   * local package */
  library: string;
  installLocation?: string;
};

export interface RunBenchmarkMessage {
  type: 'runBenchmark';
  benchmark: Omit<BenchmarkSpecification, 'installLocation'> & { installLocation: string };
}

export interface ResultMessage {
  type: 'returnResult';
  result: BenchmarkResult;
}

export interface ErrorMessage {
  type: 'returnError';
  error: Error;
}

export type IPCMessage = RunBenchmarkMessage | ResultMessage | ErrorMessage;

export type BenchmarkResult = {
  durationMillis: number[];
  documentSizeBytes: number;
};

export type PerfSendMetricType =
  | 'SUM'
  | 'COUNT'
  | 'MEDIAN'
  | 'MEAN'
  | 'MIN'
  | 'MAX'
  | 'STANDARD_DEVIATION'
  | 'THROUGHPUT'
  | 'LATENCY'
  | 'PERCENTILE_99TH'
  | 'PERCENTILE_95TH'
  | 'PERCENTILE_90TH'
  | 'PERCENTILE_80TH'
  | 'PERCENTILE_50TH';

export type PerfSendResult = {
  info: {
    test_name: string;
    tags?: string[];
    args: Record<string, number>;
  };
  metrics: {
    name: string;
    value: number;
    type?: PerfSendMetricType;
    version?: number;
  }[];
};
