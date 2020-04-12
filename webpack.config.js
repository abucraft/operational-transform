const path = require('path');

module.exports = {
    entry: './src/visualization.ts',
    devtool: "sourcemap",
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js'
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: [".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            { test: /\.ts$/, use: 'ts-loader' }
        ]
    },

    devServer: {
        contentBase: __dirname,
        compress: true,
        watchContentBase: true,
        publicPath: "/dist/",
        port: 9000
    }
};