const path = require("path");

module.exports = {
  mode: "development",
  entry: {
    "index.js": [path.resolve(__dirname, "./src/index.ts")],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
          {
            loader: "ts-loader",
          },
        ],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
    ],
  },
  resolve: {
    extensions: [".ts"],
  },
  // output: {
  //   filename: "bundle.js",
  //   path: path.resolve(__dirname, "dist"),
  // },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "[name]",
    library: "ux-components",
    libraryTarget: "umd",
    globalObject: "this",
    umdNamedDefine: true,
  },
};
