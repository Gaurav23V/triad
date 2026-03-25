import resolve from '@rollup/plugin-node-resolve'
import commonJS from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import babel from '@rollup/plugin-babel'
import typescript from '@rollup/plugin-typescript'
import replace from 'rollup-plugin-replace'

const extensions = ['.mjs', '.js', '.ts', '.json']

export default {
  input: './src/main.ts',
  external: ['nakama-runtime'],
  plugins: [
    resolve({ extensions }),
    typescript({ tsconfig: './tsconfig.json' }),
    json(),
    commonJS({ extensions }),
    babel({
      extensions,
      babelHelpers: 'bundled',
    }),
    replace({
      'process.env.TRIAD_VERSION': JSON.stringify('1.0.0'),
      preventAssignment: true,
    }),
  ],
  output: {
    file: 'build/index.js',
  },
}
