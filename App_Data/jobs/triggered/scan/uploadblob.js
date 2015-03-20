var fs = require('fs');
var parseArgs = require('minimist');

var argv;

argv = parseArgs(process.argv.slice(2));

console.dir(argv);

var azure = require('azure-storage');

var storageaccount = "sitesscannerdev";
var storagekey = "WYLY1df7AVnv5Kh0ed6UXD+z7dQzHsMGm5BAgNs2b0iH6CCMV1QK+rmIMHALKnFgRuE5hdx+0L4AQXKLVhYXjw==";

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
