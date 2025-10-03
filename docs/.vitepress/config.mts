import path from 'path';
import fs from 'fs';

import { defineGhPagesDocConfig} from "sborshik/vitepress/define-gh-pages-doc-config";


const pckgJson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../package.json'),
    { encoding: 'utf-8' },
  ),
);

export default defineGhPagesDocConfig(pckgJson, {
  appearance: 'dark',
  createdYear: '2025',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/overview' },
      { text: 'Changelog', link: `https://github.com/${pckgJson.author}/${pckgJson.name}/releases` },
      {
        text: `${pckgJson.version}`,
        items: [
          {
            items: [
              {
                text: `${pckgJson.version}`,
                link: `https://github.com/${pckgJson.author}/${pckgJson.name}/releases/tag/${pckgJson.version}`,
              },
            ],
          },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Introduction 👋',
        link: '/introduction/overview',
        items: [
          { text: 'Overview', link: '/introduction/overview' },
          { text: 'Getting started', link: '/introduction/getting-started' },
        ],
      },
      {
        text: 'Codegen ⚙️',
        link: '/codegen/config.html',
        items: [
          {
            text: 'Configuration',
            link: '/codegen/config.html',
          },
          {
            text: 'CLI',
            link: '/codegen/cli.html',
          },
        ]
      },
      {
        text: 'API ❤️‍🔥',
        link: '/endpoints/index.html',
        items: [
          {
            text: 'Endpoints',
            link: '/endpoints/index.html',
          },
          {
            text: 'Endpoint queries',
            link: '/endpoint-queries/index.html',
          },
          {
            text: 'Endpoint mutations',
            link: '/endpoint-mutations/index.html',
          },
          {
            text: 'EndpointQueryClient',
            link: '/endpoint-query-client/index.html',
          },
          {
            text: 'HttpClient',
            link: '/http-client/index.html',
          }
        ]
      }
    ],
  },
});
