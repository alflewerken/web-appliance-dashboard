const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');

module.exports = {
  cache: false, // CACHE KOMPLETT DEAKTIVIERT!
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: `static/js/bundle.[contenthash].js`,
    publicPath: '/',
    clean: true, // Alte Builds löschen
    hashFunction: 'xxhash64', // Schnellerer Hash-Algorithmus
    hashDigest: 'hex',
    hashDigestLength: 16,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      templateParameters: {
        PUBLIC_URL: ''
      }
    }),
    new HtmlWebpackPlugin({
      template: './public/service-panel.html',
      filename: 'service-panel.html',
      templateParameters: {
        PUBLIC_URL: ''
      }
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '',
          globOptions: {
            ignore: ['**/index.html', '**/service-panel.html']
          }
        }
      ]
    }),
    new Dotenv({
      systemvars: true
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  devServer: {
    port: 9081,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
