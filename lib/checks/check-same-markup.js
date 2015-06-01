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
    request = require('request');

request = request.defaults({
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': config.user_agent_chrome }
});

var removeScripts = function(html) {
    var $ = cheerio.load(html, { lowerCaseTags: true, lowerCaseAttributeNames: true });
    $('script:not([src])').remove();

    return $.html();
};

var divCount = function (html) {
    var $ = cheerio.load(html, { lowerCaseTags: true, lowerCaseAttributeNames: true });
    return $("div").filter(function(i, el) {
        return $(this).css("display") !== "none";
    }).length;
};

var check = function (website) {
    var deferred = new Deferred();

    request(website.url.href, function (err, response, body) {
        if(err){
            deferred.reject(err);
        }

        //var ieMarkup = removeScripts(website.content);
        //var chromeMarkup = removeScripts(body);
        
        var ieCount= divCount(website.content);
        var chromeCount = divCount(body);

        // Let's consider that if the number of div is almost (80%) the same then we are good
        
        var result = {
            testName: 'markup',
            passed: Math.min(ieCount, chromeCount) / Math.max(ieCount, chromeCount) > config.check_markup_threshold,
            data: ''
        };

        deferred.resolve(result);
    });


    return deferred.promise;
};

module.exports.check = check;