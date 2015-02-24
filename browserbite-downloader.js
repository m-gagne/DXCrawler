"use strict";

var promised = require("promised-io/promise");
var Deferred = require('promised-io').Deferred;
var fs = require('fs');
var _ = require('lodash');
var baseUrl = 'http://app.browserbite.com';
var apiUrl = baseUrl + '/requests/';
var requestId = '26751';
var authKey = '44cd5c55';
var jobUrl = apiUrl + '%requestId%.json?authkey=%authKey%';
var issuesUrl = apiUrl + '%requestId%/%uniqueId%/differences/%captureId%.json?authkey=%authKey%';
var results = {};
var loaded = false;
var batch = require('./lib/batch.js');
var request = require('./lib/customRequest.js');
var start = Date.now();

var formatUrl = function (url, properties) {
    var keys = Object.keys(properties);
    for (var i = 0; i < keys.length; i++) {
        var property = keys[i];
        url = url.replace(new RegExp('%' + property + '%', 'g'), properties[property]);
    }
    
    return url;
}

var promises = [];

var requests = 0;

var getBrowserCapture = function (webpage) {
    return function (capture) {
        //var deferred = new Deferred();
        requests++;
        //promises.push(deferred.promise);
        
        request(webpage.url,
            function (err, response, body) {
            var parsedBody;
            var id = capture.is_baseline ?
                    'baseline' :
                    (capture.browser.group + capture.browser.version).replace('http://');
            
            if (err) {
                parsedBody = {};
            } else {
                try {
                    parsedBody = JSON.parse(body);
                } catch (e) {
                    console.log(e);
                    parsedBody = {};
                }
            }
            
            var issues = _.reduce(parsedBody.issues, function (acum, current) {
                current.path = baseUrl + '/images/shots/' + capture.comparison_dir + '/' + current.path;
                if (current.dynamic) {
                    acum.dynamic.push(current);
                } else {
                    acum.static.push(current);
                }
                
                return acum;
            }, {
                dynamic: [],
                static: []
            });
            
            var processedCapture = {
                passes: !capture.is_defected,
                img: baseUrl + '/images/shots/' + capture.images.document,
                issues: issues
            };
            
            results[webpage.id].results[id] = processedCapture;
            requests--;

            if (requests === 0) { 
                loaded = true;                
                fs.writeFileSync('browserbiteresults.json', JSON.stringify(results, null, 2));
                console.log('done!');
                var totalTime = Math.ceil((Date.now() - start) / 1000);
                console.log('Total time: ' + totalTime);
            }
            //deferred.resolve();
        });
    };
};

var processWebpage = function (webpage) {
    
    var result = {
        //id: webpage.url.replace('http://', ''),
        id: webpage.website,
        url: webpage.url,
        results: {}
    };
    
    results[result.id] = result;
    
    _.forEach(webpage.data, getBrowserCapture(result));
};


var getResults = function () {
    console.log('finishing downloading websites resuts');
    console.log('saving websites links');
    fs.writeFile(websitesLinksFile, JSON.stringify(websites, null, 2));
    
    
    _.forEach(websites, processWebpage);
    
    console.log('downloading captures');
};


var websitesLinksFile = 'websites-links.json';

if (fs.existsSync(websitesLinksFile)) {
    console.log('reading websites links');
    var websites = JSON.parse(fs.readFileSync(websitesLinksFile, 'utf8'));
    getResults();
} else {
    var websitesFileName = 'browserbite-websites.csv';
    
    var websites = (function () {
        var websitesFile = fs.readFileSync(websitesFileName, { encoding: 'utf8' });
        return _.reduce(websitesFile.split('\r\n'), function (acum, val) {
            var items = val.split(',');
            
            if (items.length === 2 && items[1] !== '') {
                acum.push({
                    website: 'http://' + items[0],
                    url: items[1]
                });
            }
            
            return acum;
        }, []);
    }());
    
    
    batch.onFinish = getResults;
    
    
    var count = 0;
    
    var urls = _.pluck(websites, 'url');

    console.log('Downloading ' + urls.length + ' websites info');
    
    batch.start(10, urls, function (results) {
        
        var website = _.find(websites, function (website) {
            return website.url === results.url;
        });
        
        if (website) {
            website.data = JSON.parse(results.body).webpages[0].captures;
        }
    });
}