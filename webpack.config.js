const path = require("path");
const childProcess = require("child_process");
const packageJson = require("./package.json");

const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { DefinePlugin } = require("webpack");

/**
 * @type {(env: { VERSION?: string }) => import("webpack").Configuration}
 */
module.exports = (env = {}) => {
    const version = env.VERSION || "alt1";
    const isLocal = version === "alt1-local";
    const gitCommit = childProcess.execSync("git rev-parse --short HEAD").toString().trim();
    const packageVersion = packageJson.version;
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
            publicPath: isLocal ? "./" : `/${version}/`,
            filename: version === "alt1" ? `main.v${packageVersion}.${gitCommit}.js` : `main.[contenthash].js`,
            // library means that the exports from the entry file can be accessed from outside, in this case from the global scope as window.DSFEventTracker
            library: { type: "umd", name: "DSFEventTracker" },
            clean: true,
        },
        // devtool: "eval",
        devtool: "source-map",
        mode: isLocal ? "development" : "production",
        // prevent webpack from bundling these imports (alt1 libs can use them when running in nodejs)
        externals: ["sharp", "canvas", "electron/common"],
        resolve: {
            extensions: [".wasm", ".tsx", ".ts", ".mjs", ".jsx", ".js"],
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, "alt1/appconfig.json"),
                        to: ".",
                    },
                    {
                        from: path.resolve(__dirname, "alt1/assets"),
                        to: "assets",
                    },
                ],
            }),
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "alt1/index.html"),
                filename: "index.html",
                publicPath: isLocal ? "./" : `/${version}/`,
            }),
            new DefinePlugin({
                __APP_VERSION__: JSON.stringify(packageVersion),
            }),
        ],
        module: {
            // The rules section tells webpack what to do with different file types when you import them from js/ts
            rules: [
                { test: /\.tsx?$/, loader: "ts-loader" },
                { test: /\.css$/, use: ["style-loader", "css-loader"] },
                {
                    test: /\.(png|jpe?g|gif)$/i,
                    type: "asset/resource",
                    generator: {
                        filename: "assets/stock_icons/[name][ext]",
                    },
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
