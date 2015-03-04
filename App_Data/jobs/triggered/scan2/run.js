var batch = require('./lib/batch.js');
var fs = require('fs');
var parseArgs = require('minimist');
var http = require('http');

var argv = parseArgs(process.argv.slice(2));

console.dir(argv);

if (!argv.file)
    argv.file = './websites.csv';

if (!argv.prefix && argv.azure)
    argv.prefix = 'http://sites-scanner.azurewebsites.net/?url=http://';

if (!argv.prefix && argv.azurev1)
    argv.prefix = 'http://sites-scanner-dev.azurewebsites.net/api/v1/scan?url=http://';
    
if (!argv.prefix && argv.azurev2)
    argv.prefix = 'http://sites-scanner-dev.azurewebsites.net/api/v2/scan?url=http://';
    
if (!argv.prefix && argv.azuretestv1)
    argv.prefix = 'http://sites-scanner-test.azurewebsites.net/api/v1/scan?url=http://';
    
if (!argv.prefix && argv.azuretestv2)
    argv.prefix = 'http://sites-scanner-test.azurewebsites.net/api/v2/scan?url=http://';
    
if (!argv.prefix && argv.v2)
    argv.prefix = 'http://localhost:1337/api/v2/scan?url=http://';

if (!argv.prefix)
    argv.prefix = 'http://localhost:1337/api/v1/scan?url=http://';

var errorCount = 0;
var lines = fs.readFileSync(argv.file, 'utf8').trim().split('\r\n');
var prefix = argv.prefix;

var connections;

if (argv.connections)
    connections = argv.connections;
else
    connections = 5;
    
if (connections > http.globalAgent.maxSockets)
    http.globalAgent.maxSockets = connections;

console.log(lines.length + ' to analyze');

var areas = [];
var ranks = [];
var drows = {};

var websites = lines.map(function (line) {
    var split = line.split(",");
    var url = prefix + split[0];

    areas[url] = split[1];
    ranks[url] = split[2];
    
    drows[url] = {};

    return url;
});

var tests = [
    //'browserbite',
    'browserDetection',
    'cssprefixes',
    //'inputTypes',
    //'responsive',
    //'touch',
    'edge',
    'jslibs',
    'pluginfree'
//    'altImg',
//    'ariaTags',
];

var saveDataToFile = function (filename, data) {
    fs.writeFileSync(filename, data);
    console.log(filename + " created");
}

var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1;//January is 0!`

var yyyy = today.getFullYear();
if(dd<10){
    dd='0'+dd
}

if(mm<10){
    mm='0'+mm
}

var suffix = mm + '-' + dd + '-' + yyyy;
var outputResultsFile = 'results' + suffix + '.csv';
var outputOldResultsFile = 'oldresults' + suffix + '.csv';
var outputErrorsFile = 'errors' + suffix + '.txt';
var results = "";
var dresults = [];
var errors = "";

var starting = new Date();
console.log('starting date/time', starting);
console.log('processing ' + websites.length + ' sites');
console.log('date/time', new Date());
results += 'rank, area, url, ' + tests.join(', ') + ', comments\n';

function formater(data) {
    var content;

    try {
        var body = JSON.parse(data.body);
        var info = body.results;
        var url = data.url .replace(prefix, "");

        content = ranks[data.url] + ', ' + areas[data.url] + ', ' + url + ', ' + tests.reduce(function (acum, item) {
            acum.push(info[item] && info[item].passed ? 1 : 0);
            return acum;
        }, []).join(', ') + ', N/A';
        
        var row = { 
            rank: ranks[data.url], 
            area: areas[data.url],
            url: url,
            tests: []
        }
        
        tests.forEach(function (item) {
            row.tests.push(info[item] && info[item].passed ? 1 : 0);
        });
        
        drows[data.url] = row;

        console.log('Checked - ' + data.url);
    } catch (err) {
        console.log(err);
        content = ranks[data.url] + ', ' + areas[data.url] + ', ' + url + ', ' + tests.reduce(function (acum, item) {
            acum.push(0);
            return acum;
        }, []).join(', ') + ', ' + err;
        
        var row = { 
            rank: ranks[data.url], 
            area: areas[data.url],
            url: url,
            tests: []
        }
        
        tests.forEach(function (item) {
            row.tests.push(0);
        });
        
        drows[data.url] = row;
        
        console.log('error - ' + data.url, err);
    }

    content += '\n';
    return content;
}

batch.onFinish = function () {
    var ending = new Date();
    console.log('ending date/time', ending);
    
    saveDataToFile(outputOldResultsFile, results);
    saveDataToFile(outputErrorsFile, errors);
    
    var newresults = 'rank, area, url, ' + tests.join(', ') + ', comments\n';
    
    for (var n in drows) {
        var row = drows[n];
        newresults += row.rank + ", " + row.area + ", " + row.url + ", " + row.tests.join(", ") + ", N/A\n";
    }
    
    saveDataToFile(outputResultsFile, newresults);

    console.log('Errors: ' + errorCount);
    console.log('All websites finished. Thanks!');
    
    console.log('milliseconds', ending.getTime() - starting.getTime());
};

batch.onError = function (url, err) {
    errorCount++;
    console.log('error analyzing ' + url);
    errors +='error analyzing ' + url;
};

batch.start(connections, websites, function (data) {
    dresults.push(data);
    var line = formater(data);
    results += line;
});
