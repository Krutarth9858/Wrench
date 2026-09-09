// ESLint flat config.
//
// The project had a v8-style `.eslintrc.cjs` while ESLint 10 was installed, so
// `npm run lint` failed outright. The declared plugins (react-hooks 7,
// config-prettier 10) are flat-config-era, so migrating the config was the
// change that matched the project's own intent — pinning ESLint back to v8
// would have contradicted them.
//
// Same rules as the old config, expressed for the new format.
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist', 'coverage', 'node_modules', 'eslint.config.js',
      // Build tooling and vendored helpers, not application source.
      '*.config.js', '*.config.ts', 'public/**',
      // Scratch mockup kept outside the app; not shipped, not linted.
      '.tmp_login_mockup/**',
    ],
  },
  // `@eslint/js` is not resolvable from this install, so the TypeScript
  // recommended set is the base. It covers the rules that matter for .ts/.tsx.
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // The previous config used react-hooks' recommended set from the v4 era,
      // which meant exactly these two rules. v7's `recommended` adds the React
      // Compiler rules (set-state-in-effect, refs, ...), which flag ~18 places
      // across pre-existing components. Turning those on is a real change in
      // policy and a refactor, not a config migration — left for a deliberate
      // decision rather than smuggled in here.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Tests reach for `any` and globals that application code should not.
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  prettier,
);
