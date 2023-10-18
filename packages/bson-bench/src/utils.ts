import { exists as existsCallback } from "fs";
import { promisify } from "util";

export const exists = promisify(existsCallback);
