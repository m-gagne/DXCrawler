/*
 * Modern.IE main service; runs under node.js.
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

var url = require('url'),
    fs = require('fs'),
    port = process.env.PORT || 1337,
    request = require('request'),
    express = require('express'),
    app = express(),
    cheerio = require('cheerio'),
    promises = require('promised-io/promise'),
    Deferred = require('promised-io').Deferred,
    promised = require("promised-io/promise"),
    cssLoader = require('./lib/checks/loadcss.js'),
    config = require('./lib/checks/config.js'),
    jsLoader = require('./lib/checks/loadjs.js'),
    tests = require('./lib/checks/loadchecks.js').tests,
    http = require('http'),
    csv = require('csv'),
    jslinq = require('jslinq'),
    path = require('path'),
    zlib = require('zlib'),
    sanitize = require('validator').sanitize,
    charset = 'utf-8',
    querystring = require('querystring'),
    http = require('http'),
    scanner = require('./lib/scanner');
request = request.defaults({
    followAllRedirects: true,
    encoding: null,
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept': 'text/html, application/xhtml+xml, */*',
        'Accept-Encoding': 'gzip,deflate',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': config.user_agent
    }
}); //IE11

// Adjust the global agent maxSockets

if (http.globalAgent.maxSockets < 100)
    http.globalAgent.maxSockets = 100;

/**
 * Serializes a test results array and sends it via the response
 * @param {object} res The response to use to send the results
 * @param {Timestamp} start The start timestamp
 * @param {Array} resultsArray The results of all the tests
 * */
function sendResults(res, start, resultsArray, url) {
    var results = {};
    
    for (var i = 0; i < resultsArray.length; i++) {
        results[resultsArray[i].testName] = resultsArray[i];
    }
    res.writeHeader(200, {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff"
    });
    
    if (!url)
        url = (this && this.url && this.url.href) || 'http://private';
        
    var time = (Date.now() - start) / 1000;
    
    var result = { url: { uri: url }, processTime: time };
    
    if (process.env.WEBSITE_INSTANCE_ID)
        result.machine = process.env.WEBSITE_INSTANCE_ID;
        
    result.results = results;
        
    res.write(JSON.stringify(result));
    res.end();
    console.log('response', url, 'time', time);
}

/**
 * Responds with a bad request error
 * */
function sendBadRequest(res) {
    res.writeHeader(400, { "Content-Type": "text/plain" });
    res.write('Your package is malformed' + '\n');
    res.end();
}


/**
 * Responds with an internal server error
 * */
function sendInternalServerError(error, res) {
    res.writeHeader(/*500*/ 200 , { "Content-Type": "text/plain" });
    res.write(JSON.stringify(error) + '\n');
    res.end();
}

/**
 * Responds with the error and message passed as parameters
 * */
function remoteErrorResponse(response, statusCode, message, url) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write(JSON.stringify({ statusCode: statusCode, message: message }));
    response.end();
    
    if (url)
        console.log('error', url, message);
}

/**
 * Decompresses a byte array using the decompression method passed by type.
 * It supports gunzip and deflate
 * */
function decompress(body, type) {
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
}

/**
 * Gets the body of a pages and decompresses if needed
 * */
function getBody(res, body) {
    var deferred = new Deferred();
    if (res.headers['content-encoding']) {
        return decompress(body, res.headers['content-encoding']);
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
}

/**
 * Launches and returns an array with the promises of all the non parallel tests
 * (browser detection, css prefixes, etc.)
 * */
function launchNonParallelTests(tests, promisesArray, website) {
    var deferred = new Deferred();
    
    process.nextTick(function () {
        
        tests.forEach(function (test) {
            if (!test.parallel) {
                promisesArray.push(test.check(website));
            }
        });
        
        deferred.resolve(promisesArray);
    });
    
    return deferred.promise;
}

/**
 * Since several tests need HTML/JS/CSS content, fetch it all at once
 * before calling any of the tests. Note that the tests still could
 * retrieve additional content async, since they return a promise.
 */
function analyze(data, content, res) {
    var start = Date.now(),
        promisesTests = [];
    
    var website = {
        url: url.parse(data.uri),
        originalUrl: data.originalUrl,
        auth: data.auth,
        deep: data.deep,
        content: content.body,
        compression: content.compression,
        $: cheerio.load(content.body, { lowerCaseTags: true, lowerCaseAttributeNames: true })
    };
    
    var testsToRun;
    
    if (!website.deep) {
        testsToRun = tests.filter(function (test) {
            return !test.deep;
        });
    } else {
        testsToRun = tests;
    }
    
    
    testsToRun.forEach(function (test) {
        if (test.parallel) {
            promisesTests.push(test.check(website));
        }
    });
    
    cssLoader.loadCssFiles(website)
        .then(jsLoader.loadjsFiles)
        .then(launchNonParallelTests.bind(null, testsToRun, promisesTests))
        .then(promises.all)
        .then(sendResults.bind(website, res, start), sendInternalServerError.bind(website, res));
}

/**
 * Handler for the request to get the body of a page and start all the process
 * */
function processResponse(originalUrl) {
    
    return function (response, auth, deep) {
        if (typeof auth === 'boolean') {
            deep = auth;
            auth = null;
        }
        
        return function (err, res, body) {
            if (!err && res.statusCode === 200) {
                getBody(res, body)
                .then(function (result) {
                    analyze({ uri: res.request.href, auth: auth, deep: deep, originalUrl: originalUrl }, result, response);
                }, remoteErrorResponse.bind(null, response, res.statusCode));
            } else {
                remoteErrorResponse(response, res ? res.statusCode : 'No response', 'Error found: ' + err);
            }
        };
    };
}

/**
 * Decides what action needs to be done: show the main page or analyze a website
 * */
function handleRequest(req, response) {
    var requestUrl = url.parse(req.url),
        parameters = querystring.parse(requestUrl.query),
        urlToAnalyze = sanitize(decodeURIComponent(parameters.url)).xss(),
        user = sanitize(decodeURIComponent(parameters.user)).xss(),
        password = sanitize(decodeURIComponent(parameters.password)).xss(),
        deep = (parameters.deep && parameters.deep === 'true'),
        auth;
    
    // If the request gave a user/pass, send it along. Wait for 401 response before sending passwords.
    if (user !== "undefined" && password !== "undefined") {
        auth = {
            'user': user,
            'pass': password,
            'sendImmediately': false
        };
        request(urlToAnalyze,
            { auth: auth },
            processResponse(urlToAnalyze)(response, auth, deep));
    } else {
        request(urlToAnalyze, processResponse(urlToAnalyze)(response, deep));
    }
}

function sendError(error, res) {
    res.writeHeader(500 , { "Content-Type": "text/plain" });
    res.write(JSON.stringify(error) + '\n');
    res.end();
}

/*
 * Returns the CSV file of the website list
 */
function returnWebsites(req, res) {
    // TODO: get from azure storage
    var file = path.join(__dirname, "public", "websites.csv");
    fs.exists(file, function (exists) {
        if (!exists) {
            sendError("File not found", res);
        } else {
            parseCsv(req, res, file, false);
        }
    });
}

function returnScanResults(req, res) {
    var dir = "App_Data/jobs/triggered/scan2";
    var regex = new RegExp("^results(.*)-(.*)-(.*)_(.*)-(.*)-(.*).csv");
    
    // read "dir" and create an array with the files that match the given regex
    var files = fs.readdirSync(dir).filter(function (file) {
        return regex.test(file);
    });
    
    if (files.length > 0) {
        // sort files by date and then pick the most recent
        var file = files.sort(function (a, b) {
            var matchA = regex.exec(a);
            var dateA = new Date(matchA[1], matchA[2], matchA[3], matchA[4], matchA[5], matchA[6], 0);
            var matchB = regex.exec(b);
            var dateB = new Date(matchB[1], matchB[2], matchB[3], matchB[4], matchB[5], matchB[6], 0);
            return dateB - dateA;
        })[0];
        
        file = path.join(__dirname, dir, file);
        parseCsv(req, res, file, true);
    } else {
        sendError("File not found", res);
    }
}

function parseCsv(req, res, file, skipFirstRow) {
    var json = {};
    var data = [];
    csv()
        .from.stream(fs.createReadStream(file))
        .on('record', function (row) {
            data.push(row.map(function (e) { return e.trimLeft().trimRight() }));
        })
        .on('end', function () {
            json['draw'] = req.query.draw;
            var resultset = jslinq(data)
                            .select(function (item) { return item })
                            .items;
            resultset = skipFirstRow ? jslinq(resultset).skip(1).items : resultset;
            var filteredResultSet = resultset;
            if (req.query.search && req.query.search.value && req.query.search.value !== '') {
                var regex = new RegExp(req.query.search.value);
                filteredResultSet = jslinq(resultset)
                                    .where(function (array) {
                                        return array.some(function (item) { return regex.test(item); });
                                    })
                                    .items;
            }
            json['data'] = jslinq(filteredResultSet)
                            .skip(req.query.start)
                            .take(req.query.length)
                            .items;
            json['recordsTotal'] = resultset.length;
            json['recordsFiltered'] = filteredResultSet.length;
            res.write(JSON.stringify(json));
            res.end();
    });
}

/**
 * Handles the upload of a CSV file (overwrites existing file)
 */
function handleCsvUpload(req, res) {
    console.log("File to upload: " + req.files.uploadCsv.path);
    fs.readFile(req.files.uploadCsv.path, function (err, data) {
        if (err) {
            console.log("Error uploading CSV file");
        } else {
            // TODO: save somewhere else
            var newPath = __dirname + "/public/websites.csv";
            fs.writeFile(newPath, data, function () {
                // refresh page after successful upload
                res.redirect('/sites');
            });
        }
    });
}

/**
 * Decides what action needs to be done: show the main page or analyze a website (version 2)
 * */
function handleRequestV2(req, response) {
    console.log(req.url);
    var requestUrl = url.parse(req.url),
        parameters = querystring.parse(requestUrl.query),
        urlToAnalyze = sanitize(decodeURIComponent(parameters.url)).xss(),
        user = sanitize(decodeURIComponent(parameters.user)).xss(),
        password = sanitize(decodeURIComponent(parameters.password)).xss(),
        deep = (parameters.deep && parameters.deep === 'true'),
        auth;
    
    
    if (!deep)
        deep = false;
    
    scanner.scan(urlToAnalyze, user, password, deep, function (err, data) {
        if (err) {
            remoteErrorResponse(response, err.statusCode ? err.statusCode : 'No response', err.message, urlToAnalyze);
            return;
        }
        
        sendResults(response, data.start, data.results, urlToAnalyze);
    });
}

/**
 * Handles the content of a package sent via any of the plugins
 * */
function handlePackage(req, res) {
    if (!req.body.js || !req.body.css || !req.body.html || !req.body.url) {
        remoteErrorResponse(res, 400, "Missing information");
    }
    var start = Date.now(),
        cssPromises = [],
        website;
    
    //TODO: try/catch this
    try {
        website = {
            url: req.body.url ? url.parse(req.body.url.replace(/"/g, '')) : "http://privates.ite",
            content: req.body.html,
            css: null,
            js: JSON.parse(req.body.js),
            $: cheerio.load(req.body.html, { lowerCaseTags: true, lowerCaseAttributeNames: true })
        };
    } catch (e) {
        sendBadRequest(res);
        return;
    }
    
    var remoteCSS = JSON.parse(req.body.css);
    remoteCSS.forEach(function (parsedCSS) {
        if (parsedCSS.content !== '') {
            cssPromises.push(cssLoader.parseCSS(parsedCSS.content, parsedCSS.url, null, null, website));
        }
    });
    
    promised.all(cssPromises)
        .then(function (results) {
        var cssResults = [],
            promisesTests = [];
        
        cssResults.concat.apply(cssResults, results);
        website.css = cssResults;
        
        for (var i = 0; i < tests.length; i++) {
            // Call each test and save its returned promise
            promisesTests.push(tests[i].check(website));
        }
        
        promises.all(promisesTests)
                .then(sendResults.bind(null, res, start));
    });
}

// ## CORS middleware
//
// see: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.send(204);
    }
    else {
        next();
    }
};
app.use(allowCrossDomain);
app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/websites', returnWebsites);
app.get('/scanresults', returnScanResults);

app.post('/sites', handleCsvUpload);

app.get('/api/v1/scan', handleRequest);
app.post('/api/v1/package', handlePackage);
app.get('/api/v2/scan', handleRequestV2);

app.get('/test', function (req, res) {
    res.write('test');
    res.end();
});

require('events').EventEmitter.defaultMaxListeners = 0;

var server = app.listen(port);
server.timeout = 480000;
console.log('Server timeout', server.timeout);

console.log('Server started on port ' + port);
console.log('To scan a private url go to http://localhost:' + port + '/ and follow the instructions');

module.exports.port = port;