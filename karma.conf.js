// Karma configuration
// Generated on Thu Jun 04 2020 09:56:24 GMT-0400 (Eastern Daylight Time)
const aliases = require('./webpack.alias.js');

module.exports = function (config) {
    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],
        client: {
            mocha: {
                timeout: 6000
            }
        },

        // These custom headers allow us to test the Server-Timing trace linkage code
        customHeaders: [{
            match: '.*',
            name: 'Server-Timing',
            value: 'traceparent;desc="00-00000000000000000000000000000001-0000000000000002-01"'
          }, {
            match: '.*',
            name: 'Access-Control-Expose-Headers',
            value: 'Server-Timing'
        }],

        // list of files / patterns to load in the browser
        files: [
            'test/index-webpack.js'
        ],


        // list of files / patterns to exclude
        exclude: [],


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {},


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress'],


        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['Chrome', 'Firefox'],
//        browsers: ['Chrome'], // useful to speed up edit+test cycle


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: 1,

        webpack: {
            mode: 'development',
            target: 'web',
            output: {filename: 'bundle.js'},
            resolve: { alias: aliases },
            devtool: 'inline-source-map',
            module: {
                rules: [
                    {test: /\.js$/},
                    {
                        enforce: 'post',
                        exclude: /(deps|node_modules|\.test\.[tj]sx?$)/,
                        test: /\.js$/,
                        use: {
                            loader: 'istanbul-instrumenter-loader',
                            options: {esModules: true}
                        }
                    },
                    // This setting configures Node polyfills for the browser that will be
                    // added to the webpack bundle for Karma tests.
                    {parser: {node: require('./webpack.node-polyfills.js')}}
                ]
            }
        },
        coverageIstanbulReporter: {
            reports: ['json'],
            dir: '.nyc_output',
            fixWebpackSourcePaths: true,
            thresholds: {
                emitWarning: false,
                global: {
                    statements: 90,
                },
            },
        },

        reporters: ['spec', 'coverage-istanbul'],
        webpackMiddleware: {noInfo: true},
        preprocessors: {'test/index-webpack.js': ['webpack']}

    });
};
