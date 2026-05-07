import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const moduleName = 'championship-core';
const sourceDir = path.resolve('modules', moduleName);
const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipPath = path.join(distDir, `${moduleName}.zip`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`ZIP создан: ${zipPath}`);
});

archive.pipe(output);
archive.directory(sourceDir, moduleName);
archive.finalize();
