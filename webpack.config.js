const path = require("path");
const { DefinePlugin } = require("webpack");

/**
 * @type {import("webpack").Configuration}
 */
module.exports = {
    //tell webpack where to look for source files
    context: path.resolve(__dirname, "src"),
    entry: {
        //each entrypoint results in an output file
        //so this results in an output file called 'main.js' which is built from src/app.ts
        main: "./scripts/app.ts",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        // library means that the exports from the entry file can be accessed from outside, in this case from the global scope as window.TestApp
        library: { type: "umd", name: "TestApp" },
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
        new DefinePlugin({
            "process.env.WEBHOOK_CHANNEL": JSON.stringify(process.env.WEBHOOK_CHANNEL),
        }),
    ],
    module: {
        // The rules section tells webpack what to do with different file types when you import them from js/ts
        rules: [
            { test: /\.tsx?$/, loader: "ts-loader" },
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "sass-loader"],
            },
            // type:"asset" means that webpack copies the file and gives you an url to them when you import them from js
            {
                test: /\.(png|jpg|jpeg|gif|webp)$/,
                type: "asset/resource",
                generator: { filename: "[base]" },
            },
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
