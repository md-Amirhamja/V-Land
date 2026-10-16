import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['dist', 'node_modules', 'src/*.js', 'src/mapping/**', 'scripts/**', 'blender/**', 'tests/**', '*.config.js'] },
  ...tseslint.configs.recommended,
  { files: ['src/app/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] } },
];
