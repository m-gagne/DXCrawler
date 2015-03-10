var fs = require('fs');
var parseArgs = require('minimist');

var argv;

argv = parseArgs(process.argv.slice(2));

console.dir(argv);

var azure = require('azure-storage');

var storageaccount = "sitesscannertest";
var storagekey = "if83B5HbSJu32vnlKbIdbF7TQKekog05ZUgMhMjvZk1ju/vc7phVHTIgJTeobA7fX7pv2Mwlxl7ZMqKEiEe4fg==";

if (process.env.Storage_AccountName)
    storageaccount = process.env.Storage_AccountName;
if (process.env.Storage_AccessKey)
    storagekey = process.env.Storage_AccessKey;
    
var blobSvc = azure.createBlobService(storageaccount, storagekey);
var filename = 'websites.csv';

if (argv.file)
    filename = argv.file;

blobSvc.createBlockBlobFromLocalFile('dailyscan', filename, filename, function (error, result, response) {
    if (error) {
        console.log(error);
        return;
    }
});
