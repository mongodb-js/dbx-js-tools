import { type PathLike } from 'fs';
import { access } from 'fs/promises';

export const exists = (path: PathLike) =>
  access(path).then(
    () => true,
    () => false
  );
