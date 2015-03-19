var fs = require("fs");

function loadWhitelist(path) {
    var array = [];
    var text = fs.readFileSync(path, 'utf8');
    var jsonData = JSON.parse(text.toString('utf8').replace(/^\uFEFF/, ''));
    for (var i = 0; i < jsonData.whitelist.length; i++) {
        var item = jsonData.whitelist[i];
        array.push(item);
    }
    return array;
}

module.exports.load = loadWhitelist;