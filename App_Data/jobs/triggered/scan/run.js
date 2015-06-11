var batch = require('./lib/batch.js');
var config = require('../../../../lib/checks/config.js');
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
    argv.prefix = config.prefix;
    
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
    'markup',
    'pluginfree'
//    'altImg',
//    'ariaTags',
];

var prefix = argv.prefix;

var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1;//January is 0!`

var yyyy = today.getFullYear();
if(dd<10)
    dd='0'+dd;

if(mm<10)
    mm='0'+mm;

var suffix = mm + '-' + dd + '-' + yyyy + '_';
var outputResultsFile = 'results' + suffix + '.csv';
var outputErrorsFile = 'errors' + suffix + '.txt';
var summaryErrorsFile = 'summary' + suffix + '.csv';
var errors = "";

if (useazurestorage) {
    console.log('account name', config.storage_account_name);
    console.log('access key', config.storage_account_key);
}            
        
if (useazureassource) {
    var blobSvc = azure.createBlobService(config.storage_account_name, config.storage_account_key);
    console.log('reading blob', argv.file);
    blobSvc.getBlobToText(config.website_list_container_name, argv.file, function (err, text, blockBlob, response) {
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
    var blobSvc = azure.createBlobService(config.storage_account_name, config.storage_account_key);
    blobSvc.createBlockBlobFromText(config.website_list_container_name, filename, data, function (error, result, response) {
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
        var blobSvc = azure.createBlobService(config.storage_account_name, config.storage_account_key);
        
        blobSvc.createContainerIfNotExists(config.website_list_container_name, { publicAccessLevel: 'blob' }, function (error, result, response) {
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
        
        // remote site failure
        result += "WARNING - " + (body.statusCode ? "Remote site Status Code: " + body.statusCode : "");

        if (body.message) {
            if (result != "")
                result += " ";
            result += "Message: " + body.message;
        }
        
        // scanner failure
        if (typeof body == "string") {
            result = body;
        }
        
        if (result == "")
            result = "ERROR - Empty response from the Scan API";
            
        return result.replace(",", "").replace("\n", " ").replace("\r", " ");
    }
    
    function updateQuotes(value) {
        if (!!value && typeof value === 'string') {
            value = value.replace(/"/g, "'");
        }

        return value;
    }
    
    function getDataObjectSummary(testResult, prefix) {
        var summary = "";
        if (!testResult.passed && !!testResult.data) {
            if (!!prefix) {
                summary += prefix + " ";
            }
            
            var semicolon = false;
            for (var property in testResult.data) {
                if (testResult.data.hasOwnProperty(property)) {
                    if (semicolon) {
                        summary += "; ";
                    }
                    
                    var value = testResult.data[property];
                    summary += "'" + property + "': '" + updateQuotes(Array.isArray(value) ? value.join(';') : value) + "'";
                    semicolon = true;
                }
            }
        }
        
        return summary;
    }
    
    function getDataArraySummary(testResult, prefix) {
        var summary = "";
        if (!testResult.passed && !!testResult.data) {
            var endline = false;
            for (var i = 0; i < testResult.data.length; i++) {
                if (endline) {
                    summary += "\n";
                }
                
                if (!!prefix) {
                    summary += prefix + " ";
                }
                
                var rule = testResult.data[i];
                var semicolon = false;
                for (var property in rule) {
                    if (rule.hasOwnProperty(property)) {
                        if (semicolon) {
                            summary += "; ";
                        }
                        
                        var value = rule[property];
                        summary += "'" + property + "': '" + updateQuotes(Array.isArray(value) ? value.join(';') : value) + "'";
                        semicolon = true;
                    }
                }

                endline = true;
            }
        }
        
        return summary;
    }
    
    function getBrowserDetectionTestSummary(testResult) {
        var summary = '"';
        if (!testResult.passed && !!testResult.data) {
            if (!!testResult.data.javascript) {
                var javaScriptSumary = getDataArraySummary(testResult.data.javascript, "[JavaScript]");
                summary += javaScriptSumary;
            }
            
            if (!!testResult.data.comments) {
                var commentsSumary = getDataObjectSummary(testResult.data.comments, "[Comments]");

                if (summary.length > 1 && commentsSumary.length > 0) {
                    summary += "\n";
                }
                
                summary += commentsSumary;
            }
        }
        
        summary += '"';
        
        return summary;
    }
    
    function getCssPrefixesTestSummary(testResult) {
        var summary = '"';
        if (!testResult.passed && !!testResult.data) {
            var endline = false;
            for (var i = 0; i < testResult.data.length; i++) {                
                var rule = testResult.data[i];
                for (var j = 0; j < rule.selectors.length; j++) {
                    if (endline) {
                        summary += "\n";
                    }
                    
                    var selector = rule.selectors[j];
                    var semicolon = false;
                    for (var property in selector) {
                        if (selector.hasOwnProperty(property)) {
                            if (semicolon) {
                                summary += "; ";
                            } else {
                                summary += "'cssFile': '" + rule.cssFile + "'; ";
                            }
                            
                            var value = selector[property];
                            summary += "'" + property + "': '" + updateQuotes(Array.isArray(value) ? value.join(';') : value) + "'";
                            semicolon = true;
                        }
                    }
                    
                    endline = true;
                }
            }
        }
        
        summary += '"';
        
        return summary;
    }
    
    function getEdgeTestSummary(testResult) {
        return '"' + getDataObjectSummary(testResult) + '"';
    }
    
    function getJsLibsTestSummary(testResult) {
        return '"' + getDataArraySummary(testResult) + '"';

    }
    
    function getMarkupTestSummary(testResult) {
        if (!!testResult.passed && (!!testResult.excluded || !!testResult.transient)) {
            return testResult.data;
        }
        
        var summary = '"';
        if (!testResult.passed && !!testResult.data) {
            for (var i = 0; i < testResult.data.length; i++) {
                var rule = testResult.data[i];
                if (!rule.passed) {
                    if (summary.length > 1) {
                        summary += "\n";
                    }
                    
                    summary += "The number of '" + rule.element + "' element tags is different. Edge: " + rule.edgeCount + " and Chrome: " + rule.chromeCount + " (threshold: " + rule.threshold + ")";
                }
            }
        }
        
        summary += '"';
        
        return summary;
    }
    
    function getPluginFreeTestSummary(testResult) {
        return '"' + getDataObjectSummary(testResult) + '"';
    }

    function getSummary(testName, testResult) {
        var summary = null;

        switch (testName) {
            case 'browserDetection':
                summary = getBrowserDetectionTestSummary(testResult);
                break;
            case 'cssprefixes':
                summary = getCssPrefixesTestSummary(testResult);
                break;
            case 'edge':
                summary = getEdgeTestSummary(testResult);
                break;
            case 'jslibs':
                summary = getJsLibsTestSummary(testResult);
                break;
            case 'markup':
                summary = getMarkupTestSummary(testResult);
                break;
            case 'pluginfree':
                summary = getPluginFreeTestSummary(testResult);
                break;
            default:
                summary = '""';
                break;
        }

        return summary;
    }

    function processData(data) {
        var content;

        try {
            var body;
            
            if (typeof data.body != 'undefined' && data.body.indexOf('{') < 0)
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
                summary: [],
                comment: comment
            }
            
            tests.forEach(function (item) {
                var testResult = "N/A";
                var testSummary = "N/A";
                if (info && info[item]) {
                    var result = info[item];
                    testResult = result.passed ? 1 : 0;
                    testSummary = getSummary(item, result);
                }

                row.tests.push(testResult);
                row.summary.push(testSummary);
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
                var newresults = 'rank,area,url,' + tests.join(',') + ',comments\n';
                var newsummary = 'rank,area,url,' + tests.join(',') + '\n';
                
                for (var n in drows) {
                    var row = drows[n];
                    if (row.rank) {
                        newresults += row.rank + "," + row.area + "," + row.url + "," + row.tests.join(",") + "," + row.comment + "\n";
                        newsummary += row.rank + "," + row.area + "," + row.url + "," + row.summary.join(",") + "\n";
                    } else if (row.tests && row.summary) {
                        newresults += ",," + row.url + "," + row.tests.join(",") + "," + row.comment + "\n";
                        newsummary += ",," + row.url + "," + row.summary.join(",") + "\n";
                    }
                }
                
                saveDataToFile(outputResultsFile, newresults);
                saveDataToFile(summaryErrorsFile, newsummary);

                newresults = null;
                newsummary = null;
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
                summary: [],
                comment: err.toString()
            }
            
            tests.forEach(function (item) {
                row.tests.push(0);
                row.summary.push("");
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
        
        var newresults = 'rank,area,url,' + tests.join(',') + ',comments\n';
        var newsummary = 'rank,area,url,' + tests.join(',') + '\n';
        
        for (var n in drows) {
            var row = drows[n];
            if (row.rank) {
                newresults += row.rank + "," + row.area + "," + row.url + "," + row.tests.join(",") + "," + row.comment + "\n";
                newsummary += row.rank + "," + row.area + "," + row.url + "," + row.summary.join(",") + "\n";
            } else if (row.tests && row.summary) {
                newresults += ",," + row.url + "," + row.tests.join(",") + "," + row.comment + "\n";
                newsummary += ",," + row.url + "," + row.summary.join(",") + "\n";
            }
        }
        
        saveDataToFile(outputResultsFile, newresults);
        saveDataToFile(summaryErrorsFile, newsummary);

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

