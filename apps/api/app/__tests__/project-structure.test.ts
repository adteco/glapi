import fs from 'fs';
import path from 'path';

function listFilesRecursive(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursive(entryPath);
    }

    return [entryPath];
  });
}

describe('API app structure', () => {
  it('does not keep a shadow src/app tree when the root app directory is in use', () => {
    const apiRoot = path.resolve(__dirname, '../..');
    const appDirectory = path.join(apiRoot, 'app');
    const srcAppDirectory = path.join(apiRoot, 'src/app');

    expect(fs.existsSync(appDirectory)).toBe(true);

    const srcAppFiles = fs.existsSync(srcAppDirectory)
      ? listFilesRecursive(srcAppDirectory).map((filePath) =>
          path.relative(apiRoot, filePath)
        )
      : [];

    expect(srcAppFiles).toEqual([]);
  });
});
