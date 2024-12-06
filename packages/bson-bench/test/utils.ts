import * as fs from 'fs/promises';
import * as path from 'path';

import { exists } from '../src/utils';

export { exists } from '../src/utils';

/**
 * Remove all installed bson and bson-ext versions that have been installed by tests
 */
export async function clearTestedDeps(installDir: string) {
  const targetDir = path.join(installDir, 'node_modules');
  if (await exists(targetDir))
    for await (const dirent of await fs.opendir(targetDir)) {
      if (/^(bson-ext|bson)-(git|local)?.*$/.test(dirent.name)) {
        await fs.rm(path.join(targetDir, dirent.name), {
          recursive: true,
          force: true
        });
      }
    }
}
