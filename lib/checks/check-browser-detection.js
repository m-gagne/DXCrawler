/**
 * Description: Checks if a website is using browser sniffing in its JavaScript.
 * To determine this we look for known patterns (like navigator.userAgent).
 * We only look for JavaScript files in the same domain that the website.
 * If a website www.domain.com embeds scripts from www.domain.com, script.domain.com
 * and ad.server.com, only those in www.domain.com will be analyzed.
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

var Deferred = require('promised-io').Deferred,
    Promise = require('promised-io/promise'),
    request = require('request'),
    config = require('./config.js'),
    rules = [
        "navigator.userAgent",
        "navigator.appVersion",
        "navigator.appName",
        "navigator.product",
        "navigator.vendor",
        "$.browser",
        "Browser."
    ],
    urlExceptions = [
        "ajax.googleapis.com",
        "ajax.aspnetcdn.com",
        "ajax.microsoft.com",
        "jquery",
        "mootools",
        "prototype",
        "protoaculous"
    ],
    codeExceptions = [
        {
            name: "Exclude SiteCatalyst #1",
            // We cannot use the comments from the script as they are not included in website.js
            string: "if(navigator.appVersion.indexOf('MSIE')>=0)document.write(unescape('%3C')+'\\!-'+'-')"            
        },
        {
            name: "Exclude SiteCatalyst #2",
            // Might want to consider converting this to a regex to handle whitespace
            string: "if (navigator.appVersion.indexOf('MSIE') >= 0) document.write(unescape('%3C') + '\\!-' + '-')"
        }
    ];

// 2015-03-09: Deleted because it seems unnecessary

// request = request.defaults({
//    jar: false,
//    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
//    headers: {
//        'Accept-Language': 'en-US,en;q=0.5',
//        'User-Agent': config.user_agent_edge }
//});


function checkScript(script) {
    var deferred = new Deferred();
    //TODO: we should be using the predownloaded JS

    process.nextTick(function () {
        // See if this script has any of our known libraries
        var scriptText = script.content || '',
            browserDetectionPassed = true,
            ruleIndex,
            lineNumber;
        
        var i, ii, exception, exceptionFound;
        var rulesLength = rules.length;
        var exceptionsLength = codeExceptions.length;
        
        for (i = 0; i < rulesLength; i++) {
            exceptionFound = false;
            ruleIndex = scriptText.indexOf(rules[i]);
            if (ruleIndex !== -1) {
                // check to see if there is a code exception
                for (ii = 0; ii < exceptionsLength; ii++) {
                    exception = codeExceptions[ii];
                    if ( (exception.string && scriptText.indexOf(exception.string) != -1) ||
                         (exception.pattern && scriptText.match(exception.pattern))
                       ) {
                        exceptionFound = true;
                        break;
                    }
                }
                if (!exceptionFound) {
                    browserDetectionPassed = false;
                    lineNumber = scriptText.substr(0, ruleIndex).split('\n').length;
                    break;                    
                }
            }
        }

        if (!browserDetectionPassed) {
            deferred.resolve({
                passed: false,
                pattern: rules[i],
                lineNumber: lineNumber,
                url: script.jsUrl
            });
        } else {
            deferred.resolve({
                passed: true,
                url: script.jsUrl
            });
        }
    });

    return deferred;
}

function checkConditionalComments(website) {
    var test = {
        passed: true
    };

    var conditionalPosition = website.content.search(/<!--\[if ie\]>/gi);

    if (conditionalPosition !== -1) {
        test.passed = false;
        test.data = {
            lineNumber: website.content.substr(0, conditionalPosition).split('\n').length
        };
    } else {
        var targetsIE9 = website.content.search(/<!--\[if gte? ie [6-8]\]>/gi);
        if (targetsIE9 !== -1) {
            test.passed = false;
            test.data = {
                lineNumber: website.content.substr(0, targetsIE9).split('\n').length
            };
        }
    }

    return test;
}

var check = function (website) {
    var needsToBeProcessed = true;
    var scripts = website.js,
        scriptPromises = [], src;
    for (var i = 0; i < scripts.length; i++) {
        src = scripts[i];
        needsToBeProcessed = true;

        if(!src.jsUrl && src.url){
            src.jsUrl = src.url;
        }

        //If script is in a different domain chances are it is for ads or analytics. We should improve this heuristic sometime
        if(src.jsUrl !== 'embed' && website.url.resolve(src.jsUrl).indexOf(website.url.host) === -1){
            needsToBeProcessed = false;
        }

        for (var j = 0; j < urlExceptions.length && src.jsUrl !== 'embed' && needsToBeProcessed; j++) {
            if (src.jsUrl.indexOf(urlExceptions[j]) !== -1) {
                needsToBeProcessed = false;
                break;
            }
        }

        if (needsToBeProcessed) {
            scriptPromises.push(checkScript(src));
        }
    }

    return Promise.all(scriptPromises).then(function (promises) {
        var browserTest = {
            passed: true,
            data: []
        };

        for (var a = 0; a < promises.length; a++) {
            var pm = promises[a];
            if (!pm.passed) {
                browserTest.passed = false;
                browserTest.data.push(pm);
            }
        }

        var conditionalTest = checkConditionalComments(website);

        var test = {
            testName: "browserDetection",
            passed: browserTest.passed && conditionalTest.passed,
            data: {javascript: browserTest,
                comments: conditionalTest}
        };

        return test;
    });
};

module.exports.check = check;
