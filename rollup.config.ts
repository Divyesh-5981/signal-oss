import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/action/main.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json', outDir: 'dist' }),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
  ],
}
