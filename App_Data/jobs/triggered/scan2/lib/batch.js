"use strict";

var request = require('request');
var websites,
    i,
    callbacker,
    connections;

function onFinishWrap(){
    var counter = connections;

    onFinishWrap = function(){
        counter--;
        if(counter === 0){
            module.exports.onFinish();
        }
    };

    counter--;
    if(counter === 0){
        module.exports.onFinish();
    }
}

function onFinish() {
    console.log('finished processing all websites');
}

function onError(url, err) {
    console.log('Error - ' + url);
}

var getNext = function () {
    return websites[i++];
};

function requestPage(url) {
    setTimeout( function () {
        request({ url: url, timeout: 480000 }, callbacker(url));
    }, 0);
}

function pushRequestPage(url) {
    websites.push(url);
};

function callbackWrapper(callback) {
    return function (url) {
        return function (err, response, body) {
            if (err != null) {
                module.exports.onError(url, err);
            } else {
                callback({url: url, body: body});
            }

            var nextWebsite = getNext();
            if (typeof nextWebsite === 'undefined') {
                onFinishWrap();
                return;
            }

            requestPage(nextWebsite);
        };
    };
}

function start(max, webs, callback) {
    websites = webs;
    connections = max;
    callbacker = callbackWrapper(callback);

    for (i = 0; i < connections; i++)
        requestPage(websites[i]);
}

module.exports = {
    start: start,
    onFinish: onFinish,
    onError: onError,
    requestPage: requestPage,
    pushRequestPage: pushRequestPage
}