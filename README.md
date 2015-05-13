#Sites-Scanner website


##Scan API endpoint

The core functionality of the sites-scanner sites is the **scan** endpoint which is mainly a ported version of the [modern.ie static code scan repository](https://github.com/InternetExplorer/modern.IE-static-code-scan/).

We changed the original route to `/api/v2/scan` (in order to be able to test multiple version of the scanner). For instance: `http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://www.microsoft.com/`

It returns a JSON content as the original code.

##Webjob

The webjob takes batches of websites from the configured list and sends requests to the Scan API endpoint. It collects results and errors and stores them in two files prefixed with `results` and `errors`.
In order to obtain early feedback, the process dumps the results after 1000 checks and the errors after every 100 error messages.

###<a name="parameters"></a>Parameters

The webjob could be parameterized from command line or by reading the `ScanJob_Arguments` App Setting (configurable from the Azure Website portal).

 * `--source=<source>`: If the value is  `azure` it will use Azure storage and read the list of websites from the _websites.csv_ blob file. For any other value it will use file system instead. (Default value: _blank_ i.e. file system storage)
 * `--target=<target>`:  If the value is  `azure` it will store the results and errors in Azure blob storage. For any other value it will use file system instead. (Default value: _blank_ i.e. file system storage)
 * `--file=<filename>`: Used to set the input file name. (Default value: `websites.csv`) Depending on `source`, the name refers to local file system or to Azure storage.
 * `--prefix=<urlprefix>`: Used to set the Scan API endpoint URL to use. We used it for development and testing purposes and can be used to redirect the load to any other environment. We now defaulted to the _production_ environment: `http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://`
 * `--connections=<noconnections>`: Used to set the amount of simultaneous connection the webjob can execute to the Scan API. We found this useful while improving the scalability of the solution. (Default value: 20 connections).
 * `--simulation`: flag that reads the test results from a file `results.json` stored in the webjob's folder. This file must be pre populated with the results of a scan.

##Websites and Results pages

We removed the original feature to enter and scan a single url. We replaced it with the ability to upload a website list in CSV format that will be displayed  and another page to view the results (both using jQuery Datatables.)


##Deployment

Deployment can be done in three different flavors:

 * Repository integration - You can upload the entire repo to the Azure website repository.
 * Deployment script - You can drop your publish setting file, rename it to `sites-scanner.PublishSettings` and run the ´deploy.cmd´ script. This script uses the [WAWSDeploy](https://github.com/davidebbo/WAWSDeploy) tool to upload all required files using WebDeploy.
 * Manually - Upload the entire repository to the remote site's \wwwroot\ folder via FTP.

###App Settings

Three app settings are used by the website and the webjob:

- `Storage_AccountName`: the name of the storage account where the results are stored.
- `Storage_AccessKey`: the access key to the storage account where the results are stored.
- `ScanJob_Arguments`: list of arguments to the webjob, as described in the WebJob's [Parameters](#parameters) section above.

##Configurable Checks
###CSS Prefixes

The file `lib\checks\whitelisted-properties.json`:

```json
{
    "whitelist": [ ],
    "whitelist_microsoft.com": [
        "animation",
        "animation-duration",
        "appearance",
        "box-sizing",
        "text-size-adjust",
        "transition"
    ]
}
```

If you modify this file, you should restart the service to take the changes into account.


###Plugin free

The file `lib\checks\check-pluginfree.json`:

```json
{
    "allowFlash": true,
    "allowSilverlight": true,
    "allowOthers": false
}
```

If you modify this file, you should restart the service to take the changes into account.
