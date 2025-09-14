---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: '{packageJson.name}'
  text: '{packageJson.description}'
  image:
    src: /logo.png
  actions:
    - theme: brand
      text: Get Started
      link: /introduction/overview.md
    - theme: alt
      text: View on GitHub
      link: https://github.com/{packageJson.author}/{packageJson.name}
---
