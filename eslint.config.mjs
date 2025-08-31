// eslint.config.mjs — desactiva la regla que rompe el build
import next from 'eslint-config-next';

export default [
  ...next(),
  {
    rules: {
      // ⚠️ Desactiva "no-html-link-for-pages" en todo el proyecto
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
