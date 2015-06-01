/**
 * Description: Checks if the HTML send by the server is the same if we are IE11 or Chrome+
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
    jsdiff = require('diff'),
    beautify_html = require('js-beautify').html,
    request = require('request');

request = request.defaults({
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': config.user_agent_chrome }
});

var cleanMarkup = function(html) {
    var $ = cheerio.load(html, { lowerCaseTags: true, lowerCaseAttributeNames: true, normalizeWhitespace: true });
    
    // remove inline script elements
    $('script:not([src])').remove();
    
    $('*').each(function () { // iterate over all elements
        this.attribs = {};    // remove all attributes
    });

    return $.html();
};

var countElements = function ($, elementName) {
    return $(elementName).filter(function(i, el) {
        return $(this).css("display") !== "none";
    }).length;
};

var check = function (website) {
    var deferred = new Deferred();

    request(website.url.href, function (err, response, body) {
        if(err){
            deferred.reject(err);
        }
        
        var edgeMarkup = website.content;
        var chromeMarkup = body;
        
        //edgeMarkup = cleanMarkup(edgeMarkup);
        //chromeMarkup = cleanMarkup(chromeMarkup);

        //edgeMarkup = beautify_html(edgeMarkup);
        //chromeMarkup = beautify_html(chromeMarkup);
        
        //var compareResult = jsdiff.diffTrimmedLines(edgeMarkup, chromeMarkup);
        
        var $edge = cheerio.load(edgeMarkup, { lowerCaseTags: true, lowerCaseAttributeNames: true, normalizeWhitespace: true });
        var $chrome = cheerio.load(chromeMarkup, { lowerCaseTags: true, lowerCaseAttributeNames: true, normalizeWhitespace: true });
        var passed = true;

        var elementResults = [];
        for (var i = 0; i < config.check_markup_elements.length; i++) {
            var elementName = config.check_markup_elements[i];
            var edgeCount = countElements($edge, elementName);
            var chromeCount = countElements($chrome, elementName);
            var max = Math.max(edgeCount, chromeCount);
            var elementResult = {
                element: elementName,
                edgeCount: edgeCount,
                chromeCount: chromeCount,
                passed: (max <= 0) ? true : Math.min(edgeCount, chromeCount) / max > config.check_markup_threshold
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
    });


    return deferred.promise;
};

module.exports.check = check;