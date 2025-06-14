import { postBuildScript, publishScript } from 'js2me-exports-post-build-script';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

postBuildScript({
  buildDir: 'dist',
  rootDir: '.',
  srcDirName: 'src',
  filesToCopy: ['LICENSE', 'README.md'],
  updateVersion: process.env.PUBLISH_VERSION,
  onDone: (versionsDiff, _, packageJson, { targetPackageJson }) => {
    // Копируем bin.ts в bin.mjs в папку dist
    copyFileSync(
      resolve('dist/cli', 'bin.js'),
      resolve('dist/cli', 'bin.mjs')
    );

    if (process.env.PUBLISH) {
      publishScript({
        nextVersion: versionsDiff?.next ?? packageJson.version,
        currVersion: versionsDiff?.current,
        packageManager: 'pnpm',
        commitAllCurrentChanges: true,
        createTag: true,
        githubRepoLink: 'https://github.com/js2me/mobx-tanstack-query-api',
        cleanupCommand: 'pnpm clean', 
        targetPackageJson
      })
    }
  }
});

