import { defineConfig } from 'docusite';

export default defineConfig({
  packageJsonPath: '.',
  base: '/@{packageJson.name}/',
  title: '@{packageJson.name}',
  description: '@{packageJson.description}',
  search: 'local',
  changelog: {
    src: 'CHANGELOG.md',
  },
  github: 'https://github.com/@{packageJson.author}/@{packageJson.name}',
  colors: {
    light: ['#5d8eff', '#ff733f', '#0819a1'],
    dark: ['#77a0ff', '#ff8153', '#4f76ff'],
  },
  logos: {
    main: '/public/logo.png',
    hero: '/public/logo.png',
    banner: '/public/banner.png',
  },
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Introduction', link: '/introduction/overview' },
  ],
  sidebar: [
    {
      text: 'Introduction 👋',
      items: [
        { text: 'Overview', link: '/introduction/overview' },
        { text: 'Getting started', link: '/introduction/getting-started' },
      ],
    },
    {
      text: 'Codegen ⚙️',
      items: [
        { text: 'Configuration', link: '/codegen/config' },
        { text: 'CLI', link: '/codegen/cli' },
      ],
    },
    {
      text: 'API ❤️‍🔥',
      items: [
        { text: 'Endpoints', link: '/endpoints/' },
        { text: 'Endpoint queries', link: '/endpoint-queries/' },
        {
          text: 'Endpoint infinite queries',
          link: '/endpoint-infinite-queries/',
        },
        { text: 'Endpoint mutations', link: '/endpoint-mutations/' },
        { text: 'EndpointQueryClient', link: '/endpoint-query-client/' },
        { text: 'HttpClient', link: '/http-client/' },
        { text: 'Definements', link: '/definements/' },
      ],
    },
    {
      text: 'Recipes 🍳',
      items: [
        {
          text: 'Codegen without queries and mutations',
          link: '/recipes/codegen-without-queries-and-mutations',
        },
        { text: 'Connect MSW', link: '/recipes/connect-msw' },
      ],
    },
    {
      text: 'Testing 🧪',
      items: [
        {
          text: 'mockHttpClientRequest',
          link: '/testing/mock-http-client-request',
        },
        {
          text: 'mockHttpClientRequestOnce',
          link: '/testing/mock-http-client-request-once',
        },
        {
          text: 'mockHttpClientRequestSequence',
          link: '/testing/mock-http-client-request-sequence',
        },
        { text: 'mockEndpointRequest', link: '/testing/mock-endpoint-request' },
        {
          text: 'mockEndpointRequestOnce',
          link: '/testing/mock-endpoint-request-once',
        },
        {
          text: 'mockEndpointRequestSequence',
          link: '/testing/mock-endpoint-request-sequence',
        },
        {
          text: 'mockEndpointRequestWhen',
          link: '/testing/mock-endpoint-request-when',
        },
        { text: 'mswEndpointHandler', link: '/testing/msw-endpoint-handler' },
        { text: 'mswEndpointResponse', link: '/testing/msw-endpoint-response' },
        { text: 'mswPathPattern', link: '/testing/msw-path-pattern' },
        { text: 'testingDefaults', link: '/testing/testing-defaults' },
        {
          text: 'captureEndpointRequestParams',
          link: '/testing/capture-endpoint-request-params',
        },
        {
          text: 'captureInvalidations',
          link: '/testing/capture-invalidations',
        },
        { text: 'stubEndpointThrow', link: '/testing/stub-endpoint-throw' },
        {
          text: 'Low-level API',
          items: [
            {
              text: 'MockHttpResponse',
              link: '/testing/low-level/mock-http-response',
            },
            {
              text: 'createMockHttpClientRequestHandler',
              link: '/testing/low-level/create-mock-http-client-request-handler',
            },
          ],
        },
      ],
    },
  ],
  siteConfigOverrides: {
    appearance: 'dark',
  },
  themeConfigOverrides: {
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-PRESENT js2me',
    },
  },
});
