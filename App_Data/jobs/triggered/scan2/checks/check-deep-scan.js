/**
 * Description: Checks random links in the website and runs the whole scanner in
 * those to detect other compatibility issues.
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
    request = require('request');

request = request.defaults({
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko'}
});

var analyze = function (url) {
    var deferred = new Deferred();
    request('http://localhost:1337?url=' + url, function (err, res, body) {
        deferred.resolve(body);
    });

    return deferred.promise;
};

var check = function (website) {
    var allLinks = website.$('a'),
        links = [];

    allLinks.each(function () {
        var link = this.attribs.href;
        if (link && link.indexOf('//') !== 0 &&
            link.indexOf(website.url.hostname) !== -1 &&
            links.indexOf(link) === -1) {
            links.push(link);
        }
    });

    var promises = [];

    for (var i = 0; i < 5; i++) {
        promises.push(analyze(links[i]));
    }

    return Promise.all(promises).then(function (results) {
        return {
            testName: 'deep',
            data: results
        };
    });
};

module.exports.check = check;
module.exports.deep = true;