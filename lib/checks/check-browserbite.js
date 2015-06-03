/**
 * Description: This check looks for differences in rendering between different browsers using
 * Browser Bite
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

var baseUrl = 'http://app.browserbite.com',
    apiUrl = baseUrl + '/requests/',
    requestId = '26751',
    authKey = '44cd5c55',
    jobUrl = apiUrl + '%requestId%.json?authkey=%authKey%',
    issuesUrl = apiUrl + '%requestId%/%uniqueId%/differences/%captureId%.json?authkey=%authKey%',
    request = require('request'),
    promised = require("promised-io/promise"),
    Deferred = require('promised-io').Deferred,
    fs = require('fs'),
    _ = require('lodash'),
    results = {},
    loaded = false;

var resultsFile = fs.readFileSync('browserbiteresults.json', 'utf8');

try {
    results = JSON.parse(resultsFile);
} catch (e) { 
    debugger;
}

var initiate = function (website) {
    var deferred = new Deferred();

    process.nextTick(function () {
        
        //TODO: Do something more complex to know if the website passes or not

        var url = website.originalUrl;

        var test = {
            testName: "browserbite",
            passed: results[url] && results[url].results['ie11.0'] ? results[url].results['ie11.0'].passes : true,
            data: results[url]
        };

        deferred.resolve(test);
    });

    return deferred.promise;
};

module.exports.check = initiate;
module.exports.deep = true;