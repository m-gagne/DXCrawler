var url = require('url'),
    fs = require('fs'),
    port = process.env.PORT || 1337,
    request = require('request'),
    cheerio = require('cheerio'),
    promises = require('promised-io/promise'),
    Deferred = require('promised-io').Deferred,
    promised = require("promised-io/promise"),
    cssLoader = require('./checks/loadcss.js'),
    jsLoader = require('./checks/loadjs.js'),
    tests = require('./checks/loadchecks.js').tests,
    http = require('http'),
    path = require('path'),
    zlib = require('zlib'),
    sanitize = require('validator').sanitize,
    charset = 'utf-8',
    request = request.defaults({
        followAllRedirects: true,
        encoding: null,
        jar: false,
        proxy: process.env.HTTP_PROXY || process.env.http_proxy,
        headers: {
            'Accept': 'text/html, application/xhtml+xml, */*',
            'Accept-Encoding': 'gzip,deflate',
            'Accept-Language': 'en-US,en;q=0.5',
            //            'User-Agent': 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident/6.0)'}}); //IE10
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko'
        }
    }); //IE11

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
function analyze(data, content, cb) {
    if (!cb)
        console.log('missing callback');
        
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
        .then(function (data) { cb(null, { start: start, results: data }); },
			function (err) { cb(err, null) });
}

/**
 * Handler for the request to get the body of a page and start all the process
 * */
function processResponse(originalUrl) {
    
    return function (auth, deep, cb) {
        if (typeof auth === 'boolean' || typeof auth === 'undefined') {
			cb = deep;
            deep = auth;
            auth = null;
        }
        
        if (!cb)
            console.log('missing callback 2');
        
        return function (err, res, body) {
            if (!err && res.statusCode === 200) {
                getBody(res, body)
                .then(function (result) {
                    analyze({ uri: res.request.href, auth: auth, deep: deep, originalUrl: originalUrl }, result, cb);
                }, cb);
            } else {
                cb((res ? res.statusCode : 'No response') + ', Error found: ' + err, null);
            }
        };
    }
}

function scan(urlToAnalyze, user, password, deep, cb) {
    if (!cb)
        console.log('missing callback 3');
    // If the request gave a user/pass, send it along. Wait for 401 response before sending passwords.
    if (user && user !== "undefined" && password && password !== "undefined") {
        auth = {
            'user': user,
            'pass': password,
            'sendImmediately': false
        };
        request(urlToAnalyze,
            { auth: auth },
            processResponse(urlToAnalyze)(auth, deep, cb));
    } else {
        request(urlToAnalyze, processResponse(urlToAnalyze)(deep, cb));
    }
}

module.exports = {
    scan: scan
}

