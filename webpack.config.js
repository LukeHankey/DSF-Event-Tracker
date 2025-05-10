const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

/**
 * @type {(env: { VERSION?: string }) => import("webpack").Configuration}
 */
module.exports = (env = {}) => {
    const version = env.VERSION || "alt1";
    console.log("🔧 Webpack build version:", version);

    return {
        //tell webpack where to look for source files
        context: path.resolve(__dirname, "alt1"),
        entry: {
            //each entrypoint results in an output file
            //so this results in an output file called 'main.js' which is built from alt1/app.ts
            main: "./scripts/app.ts",
        },
        output: {
            path: path.resolve(__dirname, `dist/${version}`),
            // library means that the exports from the entry file can be accessed from outside, in this case from the global scope as window.DSFEventTracker
            library: { type: "umd", name: "DSFEventTracker" },
        },
        devtool: "eval",
        // devtool: "source-map",
        mode: "development",
        // prevent webpack from bundling these imports (alt1 libs can use them when running in nodejs)
        externals: ["sharp", "canvas", "electron/common"],
        resolve: {
            extensions: [".wasm", ".tsx", ".ts", ".mjs", ".jsx", ".js"],
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "alt1/assets"),
                        to: path.resolve(__dirname, "dist/alt1/assets"),
                    },
                ],
            }),
        ],
        module: {
            // The rules section tells webpack what to do with different file types when you import them from js/ts
            rules: [
                { test: /\.tsx?$/, loader: "ts-loader" },
                { test: /\.css$/, use: ["style-loader", "css-loader"] },
                {
                    test: /\.(html|json)$/,
                    type: "asset/resource",
                    generator: { filename: "[base]" },
                },
                // file types useful for writing alt1 apps, make sure these two loader come after any other json or png loaders, otherwise they will be ignored
                {
                    test: /\.data\.png$/,
                    loader: "alt1/imagedata-loader",
                    type: "javascript/auto",
                },
                { test: /\.fontmeta.json/, loader: "alt1/font-loader" },
            ],
        },
    };
};
