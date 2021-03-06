var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function(x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function(mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

module.exports = {
    mode:   'development',
    target: 'node',

    entry:  './src/app.js',
    output: {
        path:     __dirname,
        filename: 'alarm.js',
    },
    externals: nodeModules,
    module: {
        rules: [
            {
                test:    /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use:     {
                    loader: 'babel-loader',
                },
            }
        ],
    },
};
