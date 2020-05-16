// https://hackernoon.com/building-and-publishing-a-module-with-typescript-and-rollup-js-faa778c85396
// import typescript from 'rollup-plugin-typescript2'
import pkg from './package.json'
/*
export default {
  input: 'src/peer_rpc.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
    },
    {
      file: pkg.module,
      format: 'es',
    },
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
	],
	plugins: [
    typescript({
      typescript: require('typescript'),
    }),
  ],
}*/
export default {
	input: 'tsc-build/peer_rpc.js',
	output: [
		{
			file:pkg.module,
			format:'es',
		},
		{
			file:pkg.main,
			format:'cjs',
		}
	]
}