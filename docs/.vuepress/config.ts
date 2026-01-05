import { defineUserConfig } from 'vuepress'
import { defaultTheme } from '@vuepress/theme-default'
import { viteBundler } from '@vuepress/bundler-vite'
import { searchPlugin } from '@vuepress/plugin-search'

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'Croupier JavaScript SDK',
  description: 'JavaScript/TypeScript SDK for Croupier',
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }],
    ['meta', { name: 'keywords', content: 'croupier,javascript,typescript,sdk' }],
    ['meta', { name: 'theme-color', content: '#f7df1e' }],
  ],
  base: '/croupier-sdk-js/',
  bundler: viteBundler(),
  theme: defaultTheme({
    repo: 'cuihairu/croupier-sdk-js',
    repoLabel: 'GitHub',
    navbar: [
      { text: '指南', link: '/guide/' },
      { text: 'API 参考', link: '/api/' },
      {
        text: '其他 SDK',
        children: [
          { text: 'C++', link: 'https://cuihairu.github.io/croupier-sdk-cpp/' },
          { text: 'Go', link: 'https://cuihairu.github.io/croupier-sdk-go/' },
          { text: 'Java', link: 'https://cuihairu.github.io/croupier-sdk-java/' },
          { text: 'Python', link: 'https://cuihairu.github.io/croupier-sdk-python/' },
        ],
      },
      {
        text: 'Croupier 主项目',
        link: 'https://cuihairu.github.io/croupier/',
      },
    ],
    sidebar: {
      '/': [
        '/README.md',
        { text: '指南', children: ['/guide/README.md', '/guide/quick-start.md'] },
        { text: 'API', children: ['/api/README.md'] },
      ],
    },
  }),
  plugins: [
    searchPlugin({
      locales: {
        '/': { placeholder: '搜索文档' },
      },
    }),
  ],
})
