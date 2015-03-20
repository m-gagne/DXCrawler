module.exports.user_agent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0';
module.exports.storage_account_name = 'sitesscannerdev';
module.exports.storage_account_key = 'WYLY1df7AVnv5Kh0ed6UXD+z7dQzHsMGm5BAgNs2b0iH6CCMV1QK+rmIMHALKnFgRuE5hdx+0L4AQXKLVhYXjw==';
module.exports.website_list_container_name = 'dailyscan';

if (process.env.Storage_AccountName)
    module.exports.storage_account_name = process.env.Storage_AccountName;

if (process.env.Storage_AccessKey)
    module.exports.storage_account_key = process.env.Storage_AccessKey;
