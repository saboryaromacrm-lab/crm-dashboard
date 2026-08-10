/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // Herramientas que corren en Node, no en el navegador: la config de Vite
      // y los scripts de desarrollo (leen process.env, arrancan procesos).
      files: ['vite.config.js', 'scripts/**/*.{js,mjs}'],
      env: { node: true, browser: false },
    },
  ],
};
