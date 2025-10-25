import { defineDocsVitepressConfig } from "sborshik/vitepress";
import { ConfigsManager } from "sborshik/utils/configs-manager";

const configs = ConfigsManager.create("../")

export default defineDocsVitepressConfig(configs, {
  appearance: 'dark',
  createdYear: '2025',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/overview' },
      { text: 'Changelog', link: `https://github.com/${configs.package.author}/${configs.package.name}/releases` },
      {
        text: `${configs.package.version}`,
        items: [
          {
            items: [
              {
                text: `${configs.package.version}`,
                link: `https://github.com/${configs.package.author}/${configs.package.name}/releases/tag/${configs.package.version}`,
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
