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
            text: 'Endpoint infinite queries',
            link: '/endpoint-infinite-queries/index.html',
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
          },
        ]
      },
      {
        text: 'Vitest testing 🧪',
        link: '/vitest/index.html',
        items: [
          { text: 'mockHttpClientRequest', link: '/vitest/mock-http-client-request.html' },
          { text: 'mockHttpClientRequestOnce', link: '/vitest/mock-http-client-request-once.html' },
          { text: 'mockEndpointRequest', link: '/vitest/mock-endpoint-request.html' },
          { text: 'mockEndpointRequestOnce', link: '/vitest/mock-endpoint-request-once.html' },
          { text: 'mockEndpointRequestSequence', link: '/vitest/mock-endpoint-request-sequence.html' },
          { text: 'mockEndpointRequestWhen', link: '/vitest/mock-endpoint-request-when.html' },
          { text: 'captureEndpointRequestParams', link: '/vitest/capture-endpoint-request-params.html' },
          { text: 'stubEndpointThrow', link: '/vitest/stub-endpoint-throw.html' },
          {
            text: 'Low-level API',
            items: [
              { text: 'MockHttpResponse', link: '/vitest/low-level/mock-http-response.html' },
              {
                text: 'createMockHttpClientRequestHandler',
                link: '/vitest/low-level/create-mock-http-client-request-handler.html',
              },
            ],
          },
        ],
      },
    ],
  },
});
