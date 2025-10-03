import { defineConfig } from 'vitepress';

import path from 'path';
import fs from 'fs';

import jsdom from "jsdom";
import { minify } from 'htmlfy';

const pckgJson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../package.json'),
    { encoding: 'utf-8' },
  ),
);

export default defineConfig({
  title: pckgJson.name.replace(/-/g, ' '),
  appearance: 'dark',
  transformHtml(code, id, ctx) {
    const dom = new jsdom.JSDOM(code);
    const htmlDoc = dom.window.document.documentElement;
    const head = dom.window.document.head;

    const descriptionEl = head.querySelector('meta[name="description"]')!;


    const siteUrl = `https://${pckgJson.author}.github.io/${pckgJson.name}/`;
    const siteTitle = `${pckgJson.name}`;
    const siteBannerUrl = `https://${pckgJson.author}.github.io/${pckgJson.name}/banner.png`;
    const siteDescription = pckgJson.description || `${pckgJson.name} documentation website`;

    descriptionEl.setAttribute('content', siteDescription);
    descriptionEl.setAttribute('property', 'og:description');
    descriptionEl.setAttribute('data-pagefind-index-attrs', 'content');

    type CustomHeadTag = { name: string, attrs?: Record<string, any> }

    const customHeadTags: CustomHeadTag[] = [
      { name: 'link', attrs: { rel: 'canonical', href: siteUrl  } },
      { name: 'meta', attrs: { property: 'og:title', content: siteTitle } },
      { name: 'meta', attrs: { property: 'og:type', content: 'article' } },
      { name: 'meta', attrs: { property: 'og:url', content: siteUrl } },
      { name: 'meta', attrs: { property: 'og:locale', content: 'en' } },
      { name: 'meta', attrs: { property: 'og:image', content: siteBannerUrl } },
      { name: 'meta', attrs: { property: 'og:image:alt', content: `${pckgJson.name} logo` } },
      { name: 'meta', attrs: { property: 'og:site_name', content: `${pckgJson.name}` } },
      // Twitter tags
      { name: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      { name: 'meta', attrs: { name: 'twitter:site', content: `${pckgJson.name}` } },
      { name: 'meta', attrs: { name: 'twitter:title', content: siteTitle } },
      { name: 'meta', attrs: { name: 'twitter:description', content: siteDescription } },
      { name: 'meta', attrs: { name: 'twitter:image', content: siteBannerUrl } },
      { name: 'meta', attrs: { name: 'twitter:image:alt', content: `${pckgJson.name} logo` } },
    ]

    head.innerHTML =
`${head.innerHTML}${
  customHeadTags.map(tag => {
    return `<${tag.name} ${Object.entries(tag.attrs || {}).map(([attr, value]) => `${attr}="${value}"`).join(' ')}${(tag.name === 'meta' || tag.name === 'link') ? ' >' : ` ></${tag.name}>`}`;
  }).join("\n")
}`;

    return minify(htmlDoc.outerHTML);
  },
  base: `/${pckgJson.name}/`,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: `/${pckgJson.name}/logo.png` }],
  ],
  themeConfig: {
    logo: '/logo.png',
    search: {
      provider: 'local'
    },
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

    footer: {
      message: `Released under the ${pckgJson.version} License.`,
      copyright: `Copyright © 2025-PRESENT ${pckgJson.author}`,
    },

    socialLinks: [
      { icon: 'github', link: `https://github.com/${pckgJson.author}/${pckgJson.name}` },
    ],
  },
});
