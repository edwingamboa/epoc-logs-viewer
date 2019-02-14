const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

const devMode = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: {
    d3: './src/vendor/d3/d3.js',
    c3: './src/vendor/c3/c3.js',
    ss: './src/vendor/simple-statistics/simple-statistics.min.js',
    app: './src/scripts/index.js',
    main_style: './src/styles/main_style.css',
    bootstrap_style: './src/styles/bootstrap.min.css',
    c3_style: './src/vendor/c3/c3.css'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'script-loader'
        }
      },
      {
        test: /\.s?[ac]ss$/,
        use: [
          // fallback to style-loader in development
          devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/,
        use: ['file-loader']
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: ['file-loader']
      }
    ]
  },
  plugins: [
    // In general it's good practice to clean the /dist folder before each build,
    // so that only used files will be generated
    new CleanWebpackPlugin(['dist']),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: devMode ? '[name].css' : '[name].[hash].css',
      chunkFilename: devMode ? '[id].css' : '[id].[hash].css'
    }),
    // it will replace our index.html file with a newly generated one
    new HtmlWebpackPlugin({
      title: 'EPOC PMs Viewer',
      template: './src/index.html'
    }),
    // Enabling Hot Module Replacement
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  ],
  output: {
    filename: devMode ? '[name].js' : '[name].[hash].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    // prevent to duplicate dependencies
    splitChunks: {
      chunks: 'all'
    }
  }
};
