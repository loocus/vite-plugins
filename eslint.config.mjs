import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  ignores: ['**/dist/**', '**/node_modules/**'],
}, {
  // plugin/src/html.ts intentionally imports from viewer/dist at build time
  // so the template gets baked into the plugin bundle via ?raw
  files: ['packages/plugin/src/html.ts'],
  rules: {
    'antfu/no-import-dist': 'off',
  },
})
