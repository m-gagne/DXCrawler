var fs = require('fs');
var _ = require('lodash');
var fileName = 'browserbiteresults.json';


var websites = JSON.parse(fs.readFileSync(fileName, 'utf8'));

var info = _.reduce(websites, function (acum, current, key) {
    
    acum.push(_.merge(current, { website: key }));
    
    return acum;
}, []);

console.log(info[0]);

console.log('Total websites: ' + info.length);

var iepassed = _.filter(info, { results: { "ie11.0": { passes: true } } });
console.log('IE Passed: ' + iepassed.length);

var ffpassed = _.filter(info, { results: { firefox32: { passes: true } } });
console.log('FF Passed: ' + ffpassed.length);

var nonPassedFFandIE = _.filter(info, function (elem) {
    var passedFF = (elem.results.firefox32 && elem.results.firefox32.passes) || false;
    var passedIE = (elem.results["ie11.0"] && elem.results["ie11.0"].passes) || false;
    
    return !passedFF && !passedIE;
});

console.log('IE & FF failed: ' + nonPassedFFandIE.length);

fs.writeFileSync('dudosos.json', JSON.stringify(nonPassedFFandIE, null, 2));

console.log('done');