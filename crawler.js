var batch = require('./lib/batch.js');
var fs = require('fs');
var lines = fs.readFileSync('websites.csv', 'utf8').trim().split('\r\n');
var prefix = 'http://localhost:1337/?url=http://';
var errorCount = 0;

console.log(lines.length + ' to crawl');

var areas = [];

var websites = lines.map(function (line) {
    var split = line.split(",");
    var url = prefix + split[0];

    areas[url] = "USA";//split[1];

    return url;
});

var tests = [
    'browserbite',
    'browserDetection',
    'cssprefixes',
    'inputTypes',
    //'responsive',
    //'touch',
    'edge',
    'jslibs',
    'pluginfree'
//    'altImg',
//    'ariaTags',
];

console.log('starting');
fs.writeFile('results.csv', 'area, url, ' + tests.join(', ') + '\n');
fs.writeFile('errors.txt', '');

function formater(data) {
    
    var content;
    
    try {
        var body = JSON.parse(data.body);
        var info = body.results;
        var url = body.url.uri;

        content = areas[data.url] + ', ' + url + ', ' + tests.reduce(function(acum, item) {
            acum.push(info[item].passed ? 1 : 0);
            return acum;
        }, []).join(', ');
        
        content += '\n';
    } catch (err) {        
        content = '';
    }

    
    return content;
}

batch.onFinish = function () {
    console.log('Errors: ' + errorCount);
    console.log('All websites finished. Thanks!');
};

batch.onError = function (url, err) {
    errorCount++;
    console.log('error analyzing ' + url);
    fs.writeFile('errors.txt', 'error analyzing ' + url);
};

var total = websites.length;

batch.start(total, websites, function (data) {
    var line = formater(data);
    fs.appendFile('results.csv', line);
    console.log('Checked - ' + data.url);
});