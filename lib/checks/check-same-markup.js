/**
 * Description: Checks if the HTML send by the server is the same if we are Edge or Chrome+
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
    cheerio = require('cheerio'),
    config = require('./config.js'),
    zlib = require('zlib'),
    request = require('request');

request = request.defaults({
    followAllRedirects: true,
    encoding: null,
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept': 'text/html, application/xhtml+xml, */*',
        'Accept-Encoding': 'gzip,deflate',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': config.user_agent_chrome
    }
});

var countElements = function ($, elementName) {
    return $(elementName).filter(function (i, el) {
        return $(this).css("display") !== "none";
    }).length;
};

var decompress = function (body, type) {
    var deferred = new Deferred();
    
    if (type === 'gzip') {
        zlib.gunzip(body, function (err, data) {
            if (!err) {
                deferred.resolve({
                    body: data.toString(charset),
                    compression: 'gzip'
                });
            } else {
                deferred.reject('Error found: can\'t gunzip content ' + err);
            }
        });
    } else if (type === 'deflate') {
        zlib.inflateRaw(body, function (err, data) {
            if (!err) {
                deferred.resolve({
                    body: data.toString(charset),
                    compression: 'deflate'
                }
                );
            } else {
                deferred.reject('Error found: can\'t deflate content' + err);
            }
        });
    } else {
        process.nextTick(function () {
            deferred.reject("Unknown content encoding: " + type);
        });
    }
    
    return deferred.promise;
};

var getBody = function (response, body) {
    var deferred = new Deferred();
    
    if (response.headers['content-encoding']) {
        return decompress(body, response.headers['content-encoding']);
    } else {
        process.nextTick(function () {
            if (body) {
                deferred.resolve({
                    body: body.toString(charset),
                    compression: 'none'
                });
            } else {
                deferred.reject('Error found: Empty body');
            }
        });
    }
    
    return deferred.promise;
};

var check = function (website) {
    var deferred = new Deferred();
    
    request(website.url.href, function (err, response, body) {
        if (err) {
            deferred.reject(err);
        } else {
            getBody(response, body)
                .then(function (r) {
                    var edgeMarkup = website.content;
                    var chromeMarkup = r.body;
                
                    var $edge = cheerio.load(edgeMarkup, { lowerCaseTags: true, lowerCaseAttributeNames: true, normalizeWhitespace: true });
                    var $chrome = cheerio.load(chromeMarkup, { lowerCaseTags: true, lowerCaseAttributeNames: true, normalizeWhitespace: true });
                    var passed = true;
                
                    var elementResults = [];
                    for (var i = 0; i < config.check_markup_elements.length; i++) {
                        var elementName = config.check_markup_elements[i];
                        var edgeCount = countElements($edge, elementName);
                        var chromeCount = countElements($chrome, elementName);
                        var maxCount = Math.max(edgeCount, chromeCount);
                        var elementResult = {
                            element: elementName,
                            edgeCount: edgeCount,
                            chromeCount: chromeCount,
                            passed: (maxCount <= 0) ? true : Math.min(edgeCount, chromeCount) / maxCount >= config.check_markup_threshold
                        };
                    
                        elementResults.push(elementResult);
                        passed = passed && elementResult.passed;
                    }
                
                    var result = {
                        testName: 'markup',
                        passed: passed,
                        data: elementResults
                    };
                
                    deferred.resolve(result);
                }, function (e) {
                    deferred.reject(e);
                });
        }
    });
    
    return deferred.promise;
};

module.exports.check = check;