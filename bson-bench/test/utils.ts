import * as fs from "fs/promises";
import * as path from "path";

export async function* walk(
  directory: string,
  filter: (fullPath: string) => boolean = () => true,
): AsyncGenerator<string> {
  for await (const dirent of await fs.opendir(directory)) {
    const fullPath = path.join(directory, dirent.name);
    if (dirent.isDirectory()) yield* walk(fullPath, filter);
    if (!filter(fullPath)) continue;
    else if (dirent.isFile()) yield fullPath;
  }
}
export async function listAllFilesIn(
  directory: string,
  filter: (fullPath: string) => boolean = () => true,
): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of walk(directory, filter)) files.push(entry);
  files.sort(alphabetically);
  return files;
}

export function alphabetically(a: unknown, b: unknown): number {
  return `${a}`.localeCompare(`${b}`, "en-US", {
    usage: "sort",
    numeric: true,
    ignorePunctuation: false,
  });
}

export async function clearTestedDeps() {
  // Walk node_modules and delete all bson-ext and bson versions under test
  for await (const dirent of await fs.opendir("node_modules")) {
    if (/^(bson-ext|bson)-(git|local)?.*$/.test(dirent.name)) {
      fs.rm(path.join("node_modules", dirent.name), {
        recursive: true,
        force: true,
      });
    }
  }
}
