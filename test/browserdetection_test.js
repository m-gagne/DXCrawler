/**
 * Description: Test the Browser Detection
 *
 * Copyright (c) Microsoft Corporation; All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * THIS CODE IS PROVIDED AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER
 * EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS
 * OF TITLE, FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABLITY OR NON-INFRINGEMENT.
 *
 * See the Apache Version 2.0 License for specific language governing permissions
 * and limitations under the License.
 */

"use strict";

var checkBrowserDetection = require('../lib/checks/check-browser-detection.js'),
    url = require('url'),
    request = require('request'),
    cheerio = require('cheerio'),
    jsloader = require('../lib/checks/loadjs.js'),
    testServer = require('../static/test-server.js'),
    testUrl = 'http://localhost:' + testServer.port + '/browserdetection-';


function checkPage(page, test, expected) {
    var uri = testUrl + page,
        dataKeys = [],
        tests = 1;

    if (expected.data) {
        dataKeys = Object.keys(expected.data[0]);
        tests += dataKeys.length * expected.data.length;
    }

    test.expect(tests);

    request(uri, function (error, response, content) {
        var website = {
            url: url.parse(uri),
            content: content,
            $: cheerio.load(content)
        };
        jsloader.loadjsFiles(website)
            .then(checkBrowserDetection.check)
            .then(function (result) {
                var jsData = result.data.javascript.data;
                test.equal(result.passed, expected.passed, uri + " " + jsData.join("\n"));
                if (expected.data) {
                    for (var i = 0; i < expected.data.length; i++) {
                        for (var key in expected.data[i]) {
                            test.equal(jsData[i][key], expected.data[i][key], uri + " " + jsData[i][key]);
                        }
                    }
                }
                
                test.done();
            });
    });
}


module.exports['Browser Detection'] = {
    'SiteCatalyst Exclusion': function (test) {
        checkPage('1.html', test, {
            passed: true
        });
    }    
};