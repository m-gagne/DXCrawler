var batch = require('./lib/batch.js');
var azure = require('azure-storage');
var fs = require('fs');
var lines = fs.readFileSync('./websites.csv', 'utf8').trim().split('\r\n');
var prefix = 'http://sites-scanner.azurewebsites.net/?url=http://';
var errorCount = 0;

console.log(lines.length + ' to analyze');

var areas = [];
var ranks = [];

var websites = lines.map(function (line) {
    var split = line.split(",");
    var url = prefix + split[0];

    areas[url] = split[1];
    ranks[url] = split[2];

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

// Storage
var blobSvc = azure.createBlobService("davca", "SUMoeDtEXUIWq5oxzf1m3VDGLkzCgXmso0lJr7Db7OecXk4/3u6bXj0AgWmX6o56ZZMGkalWjDgk1NYOtrlgKw==");

var saveDataToFile = function (filename, data) {
    blobSvc.createBlockBlobFromText('dailyscan', filename, data, function (error, result, response) {
        if (!error) {
            // file uploaded
            console.log(filename + " created");
        }
    });
}


blobSvc.createContainerIfNotExists('dailyscan', { publicAccessLevel: 'blob' }, function (error, result, response) {
    if (!error) {
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
        var outputErrorsFile = 'errors' + suffix + '.txt';
        var results = "";
        var errors = "";

        console.log('starting processing ' + websites.length + ' sites');
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

                console.log('Checked - ' + data.url);
            } catch (err) {
                console.log(err);
                content = ranks[data.url] + ', ' + areas[data.url] + ', ' + url + ', ' + tests.reduce(function (acum, item) {
                    acum.push(0);
                    return acum;
                }, []).join(', ') + ', ' + err;
            }

            content += '\n';
            return content;
        }

        batch.onFinish = function () {
            saveDataToFile(outputResultsFile, results);
            saveDataToFile(outputErrorsFile, errors);

            console.log('Errors: ' + errorCount);
            console.log('All websites finished. Thanks!');
        };

        batch.onError = function (url, err) {
            errorCount++;
            console.log('error analyzing ' + url);
            errors +='error analyzing ' + url;
        };

        batch.start(1, websites, function (data) {
            var line = formater(data);
            results += line;
        });
    }
});
