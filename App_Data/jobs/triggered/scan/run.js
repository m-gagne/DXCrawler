var batch = require('./lib/batch.js');
var fs = require('fs');
var parseArgs = require('minimist');
var http = require('http');

var argv;

if (process.env.ScanJob_Arguments)
    argv = parseArgs(process.env.ScanJob_Arguments.split(/\s+/));
else
    argv = parseArgs(process.argv.slice(2));

console.dir(argv);

var useazurestorage = false;
var useazureastarget = false;
var useazureassource = false;

if (!argv.target || argv.target == 'azure') {
    useazurestorage = true;
    useazureastarget = true;
    var azure = require('azure-storage');
}

if (!argv.source || argv.source == 'azure') {
    useazurestorage = true;
    useazureassource = true;
    var azure = require('azure-storage');
}

var issimulation = false;

if (argv.simulation) {
    var jsonresponse = JSON.stringify(require('./response.json'));
    issimulation = true;
}

if (!argv.file)
    if (argv.source == 'azure')
        argv.file = 'websites.csv';
    else
        argv.file = './websites.csv';

if (!argv.prefix && argv.azure)
    argv.prefix = 'http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://';

if (!argv.prefix && argv.azuredev)
    argv.prefix = 'http://sites-scanner-dev.azurewebsites.net/api/v2/scan?url=http://';
    
if (!argv.prefix && argv.azuretest)
    argv.prefix = 'http://sites-scanner-test.azurewebsites.net/api/v2/scan?url=http://';
    
if (!argv.prefix)
    argv.prefix = 'http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://';
    
var machines = {};
var connections;

if (argv.connections)
    connections = argv.connections;
else
    connections = 20;
    
if (connections > http.globalAgent.maxSockets)
    http.globalAgent.maxSockets = connections;

var errorCount = 0;
var areas = [];
var ranks = [];
var drows = {};
var nrows = 0;

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

var prefix = argv.prefix;

var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1;//January is 0!`
var hours = today.getHours();
var minutes = today.getMinutes();
var seconds = today.getSeconds();

var yyyy = today.getFullYear();
if(dd<10)
    dd='0'+dd;

if(mm<10)
    mm='0'+mm;

if (hours < 10)
    hours = '0' + hours;
if (minutes < 10)
    minutes = '0' + minutes;
if (seconds < 10)
    seconds = '0' + seconds;

var suffix = mm + '-' + dd + '-' + yyyy + '_' + hours + '-' + minutes + '-' + seconds;
var outputResultsFile = 'results' + suffix + '.csv';
var outputErrorsFile = 'errors' + suffix + '.txt';
var errors = "";

if (useazurestorage) {
    var storageaccount = "sitesscannerdev";
    var storagekey = "WYLY1df7AVnv5Kh0ed6UXD+z7dQzHsMGm5BAgNs2b0iH6CCMV1QK+rmIMHALKnFgRuE5hdx+0L4AQXKLVhYXjw==";
    if (process.env.Storage_AccountName) {
        console.log('getting account name');
        storageaccount = process.env.Storage_AccountName;
    }

    if (process.env.Storage_AccessKey) {
        console.log('getting access key');
        storagekey = process.env.Storage_AccessKey;
    }

    console.log('account name', storageaccount);
    console.log('access key', storagekey);
}            
        
if (useazureassource) {
    var blobSvc = azure.createBlobService(storageaccount, storagekey);
    console.log('reading blob', argv.file);
    blobSvc.getBlobToText('dailyscan', argv.file, function (err, text, blockBlob, response) {
        if (err) {
            console.log(err);
            return;
        }
        
        var lines = text.trim().split('\r\n');
        doLines(lines);
    });
}
else {
    var lines = fs.readFileSync(argv.file, 'utf8').trim().split('\r\n');

    doLines(lines);
}

function saveDataToAzureFile(filename, data) {
    var blobSvc = azure.createBlobService(storageaccount, storagekey);
    blobSvc.createBlockBlobFromText('dailyscan', filename, data, function (error, result, response) {
        if (!error) {
            // file uploaded
            console.log(filename + " created");
        }
    });
}

function saveDataToFile(filename, data) {
    if (useazureastarget) {
        saveDataToAzureFile(filename, data);
        return;
    }
    
    fs.writeFileSync(filename, data);
    console.log(filename + " created");
}

var starting;

function doLines(lines) {
    console.log(lines.length + ' to analyze');

    var websites = lines.map(function (line) {
        var split = line.split(",");
        var url = prefix + split[0];

        areas[url] = split[1];
        ranks[url] = split[2];
        
        drows[url] = {};

        return url;
    });

    starting = new Date();
    console.log('starting date/time', starting);
    console.log('processing ' + websites.length + ' sites');
    console.log('date/time', new Date());

    if (useazurestorage) {
        var blobSvc = azure.createBlobService(storageaccount, storagekey);
        
        blobSvc.createContainerIfNotExists('dailyscan', { publicAccessLevel: 'blob' }, function (error, result, response) {
            if (error)
                console.log(error);
            else
                doWork(websites);
        });
    }
    else
        doWork(websites);
}

function doWork(websites) {
    function getComment(body) {
        if (body.results)
            return "N/A";
            
        var result = "";
            
        if (body.statusCode)
            result += "WARNING - Status Code: " + body.statusCode;
        if (body.message) {
            if (result != "")
                result += " ";
            result += "Message: " + body.message;
        }
        
        if (typeof body == "string")
            result = body;
        
        if (result == "")
            result = "Error retrieving results";
            
        return result.replace(",", "").replace("\n", " ").replace("\r", " ");
    }

    function processData(data) {
        var content;

        try {
            var body;
            
            if (data.body && data.body.indexOf('{') < 0)
                body = data.body;
            else
                body = JSON.parse(data.body);
                
            if (body.machine) {
                if (!machines[body.machine])
                    machines[body.machine] = 0;
                machines[body.machine] = machines[body.machine] + 1;
            }
                
            var info = body.results;
            var url = data.url .replace(prefix, "");
            var comment = getComment(body);

            var row = { 
                rank: ranks[data.url], 
                area: areas[data.url],
                url: url,
                tests: [],
                comment: comment
            }
            
            tests.forEach(function (item) {
                var testResult = "N/A";
                if (info && info[item]) {
                    if (info[item].passed)
                        testResult = 1;
                    else
                        testResult = 0;
                }
                row.tests.push(testResult);
            });

            console.log('Checked - ' + data.url);

            if (comment != "N/A" && comment) {
                console.log(comment);
                batch.onError(data.url, comment);
                
                if (comment.indexOf("ENOTFOUND") < 0 && data.url && (!drows[data.url] || !drows[data.url].url)) {
                    console.log('To Retry', data.url);
                    batch.pushRequestPage(data.url);
                }
            }
            
            drows[data.url] = row;
            nrows++;
            
            // dump partial results every 1000 checks
            if (nrows % 1000 == 0) {
                var newresults = 'rank, area, url, ' + tests.join(', ') + ', comments\n';
                
                for (var n in drows) {
                    var row = drows[n];
                    if (row.rank)
                        newresults += row.rank + ", " + row.area + ", " + row.url + ", " + row.tests.join(", ") + ", " + row.comment + "\n";
                    else if (row.tests)
                        newresults += ", , " + row.url + ", " + row.tests.join(", ") + ", " + row.comment + "\n";
                }
                
                saveDataToFile(outputResultsFile, newresults);
                newresults = null;
            }
        } catch (err) {
            console.log(err);
            console.log("data");
            console.dir(data);
            
            var comment = err.toString().replace(",", "").replace("\n", " ").replace("\r"," ");
            
            if (!url && data.url)
                try {
                    url = data.url.replace(prefix, "");
                }
                catch (err) { }
            
            var row = { 
                rank: ranks[data.url], 
                area: areas[data.url],
                url: url,
                tests: [],
                comment: err.toString()
            }
            
            tests.forEach(function (item) {
                row.tests.push(0);
            });
            
            console.log('error - ' + data.url, err);
            batch.onError(data.url, err);
            
            if (data && data.body == '' && data.url && (!drows[data.url] || !drows[data.url].url)) {
                console.log('To Retry', data.url);
                batch.pushRequestPage(data.url);
            }
            
            drows[data.url] = row;
        }

        content += '\n';
        return content;
    }

    batch.onFinish = function () {
        var ending = new Date();
        console.log('ending date/time', ending);
        
        saveDataToFile(outputErrorsFile, errors);
        
        var newresults = 'rank, area, url, ' + tests.join(', ') + ', comments\n';
        
        for (var n in drows) {
            var row = drows[n];
            if (row.rank)
                newresults += row.rank + ", " + row.area + ", " + row.url + ", " + row.tests.join(", ") + ", " + row.comment + "\n";
            else if (row.tests)
                newresults += ", , " + row.url + ", " + row.tests.join(", ") + ", " + row.comment + "\n";
        }
        
        saveDataToFile(outputResultsFile, newresults);

        console.log('Errors: ' + errorCount);
        console.log('All websites finished. Thanks!');
        
        console.log('milliseconds', ending.getTime() - starting.getTime());
        
        for (var n in machines)
            console.log('machine', n, machines[n]);
    };

    batch.onError = function (url, err) {
        errorCount++;
        console.log('error analyzing ' + url);
        errors += url + ", " + err.toString().replace(",","").replace("\n"," ").replace("\r"," ") + "\n";
        
        // dump error results every 100 errors
        if (errorCount % 100 == 0)
            saveDataToFile(outputErrorsFile, errors);
    };

    if (issimulation) {
        websites.forEach(function (website) {
            var data = { url: website, body: jsonresponse };
            processData(data);
        });
        
        batch.onFinish();
    }
    else   
        batch.start(connections, websites, function (data) {
            processData(data);
        });
}

