
var scanner = require('./lib/scanner');

scanner.scan(process.argv[2], null, null, false, function (err, data) {
	console.dir(err);
	console.dir(data);
});

