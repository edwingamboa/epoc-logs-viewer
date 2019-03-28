const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

const devMode = process.env.NODE_ENV !== 'production';

const appTitle = 'EPOC PMs Viewer';

module.exports = {
  entry: {
    collective: './src/scripts/collective-analysis.js',
    app: './src/scripts/index.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules|index\.js/,
        use: {
          loader: 'babel-loader'
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
      },
      { // for ttest to work properly with fs
        test: /\.js$/,
        include: path.resolve(__dirname, 'node_modules/cephes/cephes-wrapper.js'),
        loader: 'transform-loader/cacheable?brfs'
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
      template: './src/index.html',
      inject: 'body',
      filename: 'index.html',
      templateParameters: {
        appTitle: `${appTitle}`
      },
      chunks: [ 'app' ]
    }),
    new HtmlWebpackPlugin({
      inject: 'body',
      template: './src/collective-analysis.html',
      filename: 'collective.html',
      templateParameters: {
        appTitle: `${appTitle}`
      },
      chunks: [ 'collective' ]
    }),
    // Enabling Hot Module Replacement
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  ],
  output: {
    filename: devMode ? '[name].js' : '[name].[hash].js',
    path: path.resolve(__dirname, 'dist')
  }
};
