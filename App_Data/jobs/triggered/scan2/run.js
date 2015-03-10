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

if (argv.storage) {
    useazurestorage = true;
    var azure = require('azure-storage');
}

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
    
var machines = {};

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

var saveDataToAzureFile = function (filename, data) {
    blobSvc.createBlockBlobFromText('dailyscan', filename, data, function (error, result, response) {
        if (!error) {
            // file uploaded
            console.log(filename + " created");
        }
    });
}

var saveDataToFile = function (filename, data) {
    if (useazurestorage) {
        saveDataToAzureFile(filename, data);
        return;
    }
    
    fs.writeFileSync(filename, data);
    console.log(filename + " created");
}

var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1;//January is 0!`
var hours = today.getHours();
var minutes = today.getMinutes();
var seconds = today.getSeconds();

var yyyy = today.getFullYear();
if(dd<10){
    dd='0'+dd
}

if(mm<10){
    mm='0'+mm
}

if (hours < 10)
    hours = '0' + hours;
if (minutes < 10)
    minutes = '0' + minutes;
if (seconds < 10)
    seconds = '0' + seconds;

var suffix = mm + '-' + dd + '-' + yyyy + '_' + hours + '-' + minutes + '-' + seconds;
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

var storageaccount = "sitesscannerdev";
var storagekey = "WYLY1df7AVnv5Kh0ed6UXD+z7dQzHsMGm5BAgNs2b0iH6CCMV1QK+rmIMHALKnFgRuE5hdx+0L4AQXKLVhYXjw==";

if (useazurestorage) {
    if (process.env.Storage_AccountName) {
        console.log('getting account name');
        storageaccount = process.env.Storage_AccountName;
    }
    
    if (process.env.Storage_AccessKey) {
        console.log('getting access key');
        storagekey = process.env.Storage_AccessKey;
    }
    
    console.log('account name', storageaccount);
    console.log('access key', accesskey);
        
    var blobSvc = azure.createBlobService(storageaccount, storagekey);
    
    blobSvc.createContainerIfNotExists('dailyscan', { publicAccessLevel: 'blob' }, function (error, result, response) {
        if (error)
            console.log(error);
        else
            doWork();
    });
}
else
    doWork();

function doWork() {
    function getComment(body) {
        if (body.results)
            return "N/A";
            
        var result = "";
            
        if (body.statusCode)
            result += "Status Code: " + body.statusCode;
        if (body.message) {
            if (result != "")
                result += " ";
            result += "Message: " + body.message;
        }
        
        if (typeof body == "string")
            result = body;
        
        if (result == "")
            result = "Error retrieving results";
            
        return result.replace(",","");
    }

    function formater(data) {
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

            content = ranks[data.url] + ', ' + areas[data.url] + ', ' + url + ', ' + tests.reduce(function (acum, item) {
                acum.push(info && info[item] && info[item].passed ? 1 : 0);
                return acum;
            }, []).join(', ') + ', ' + comment;
            
            var row = { 
                rank: ranks[data.url], 
                area: areas[data.url],
                url: url,
                tests: [],
                comment: comment
            }
            
            tests.forEach(function (item) {
                row.tests.push(info && info[item] && info[item].passed ? 1 : 0);
            });
            
            drows[data.url] = row;

            console.log('Checked - ' + data.url);

            if (comment != "N/A")
                console.log(comment);
        } catch (err) {
            console.log(err);
            console.log("data");
            console.dir(data);
            content = ranks[data.url] + ', ' + areas[data.url] + ', ' + url + ', ' + tests.reduce(function (acum, item) {
                acum.push(0);
                return acum;
            }, []).join(', ') + ', ' + err;
            
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
            if (row.rank)
                newresults += row.rank + ", " + row.area + ", " + row.url + ", " + row.tests.join(", ") + ", " + row.comment + "\n";
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
        errors +='error analyzing ' + url;
    };

    batch.start(connections, websites, function (data) {
        dresults.push(data);
        var line = formater(data);
        results += line;
    });
}

