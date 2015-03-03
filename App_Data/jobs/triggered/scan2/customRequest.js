"use strict";

var request = require('request');

request = request.defaults({
    jar: false,
    proxy: process.env.HTTP_PROXY || process.env.http_proxy,
    headers: {
        'Accept-Language': 'en-US,en;q=0.5',
        'Set-Cookie': '_session_id=cc412b2605baa0c53c2b5da440efc198; path=/; HttpOnly',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko'
    }
});

var max = 10;
var used = 0;

var queue = []

var callbackWrapper = function (callback) {
    
    return function () {
        used--;
        callback.apply(null, arguments);
        next();
    }
}

var next = function () {
    if (queue.length > 0) {
        var first = queue.splice(0, 1)[0];
        console.log('Requests in queue:' + queue.length);
        customRequest(first.url, first.callback);
    }
};

var customRequest = function (url, callback) {
    if (used < max) {
        used++;
        request(url, callbackWrapper(callback));
    } else {
        queue.push({
            url: url,
            callback: callbackWrapper(callback)
        });
    }
};

module.exports = customRequest;