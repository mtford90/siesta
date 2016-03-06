/**
 * React Native Webpack Starter Kit
 * https://github.com/jhabdas/react-native-webpack-starter-kit
 */
(function () {
  'use strict'

  var path = require('path')
  var webpack = require('webpack')

  var config = {
    debug: true,
    devtool: 'inline-source-map',
    entry: {
      'siesta': [
        'babel-regenerator-runtime',
        './core/index.js'
      ],
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: '[name].js',
    },
    module: {
      loaders: [
        {
          test: /\.(js|jsx|es6)$/,
          exclude: /node_modules/,
          loader: 'babel',
          query: {
            cacheDirectory: false,
            presets: [
              'es2015',
              'stage-0',
              'stage-1',
            ],
            plugins: []
          }
        },
      ]
    },
    plugins: []
  }

  module.exports = config
}())
