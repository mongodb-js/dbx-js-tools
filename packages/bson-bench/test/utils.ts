import * as fs from 'fs/promises';
import * as path from 'path';

export { exists } from '../src/utils';

/**
 * Remove all installed bson and bson-ext versions that have been installed by tests
 */
export async function clearTestedDeps() {
  for await (const dirent of await fs.opendir('../../node_modules')) {
    if (/^(bson-ext|bson)-(git|local)?.*$/.test(dirent.name)) {
      await fs.rm(path.join('../../node_modules', dirent.name), {
        recursive: true,
        force: true
      });
    }
  }
}
