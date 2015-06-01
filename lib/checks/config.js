module.exports.user_agent_edge = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36 Edge/12.0';
module.exports.user_agent_chrome = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36';
module.exports.check_markup_threshold = 0.8;
module.exports.storage_account_name = 'sitesscannertest';
module.exports.storage_account_key = 'UWsqiL6p4I23OHCvv49qikhm8YwqruuqML/b5EEH1TK5IUhsGjRQKOccHhQ8C1MiR2GUc4Gm12NAIYLOfwrZow==';
module.exports.website_list_container_name = 'dailyscan';
module.exports.prefix = 'http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://';
module.exports.compatlisturlGDR = 'http://cvlist.ie.microsoft.com/0315000/1426178821/iecompatviewlist.xml';
module.exports.compatlisturlSDR = 'http://cvlist.ie.microsoft.com/0315000/1426178821/iecompatviewlist.xml';

if (process.env.Storage_AccountName)
    module.exports.storage_account_name = process.env.Storage_AccountName;

if (process.env.Storage_AccessKey)
    module.exports.storage_account_key = process.env.Storage_AccessKey;