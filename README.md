#Sites-Scanner website


##Scan API endpoint

The core functionality of the sites-scanner sites is the **scan** endpoint which is mainly a ported version of the modern.ie static code scan [repository](https://github.com/InternetExplorer/modern.IE-static-code-scan/).

We changed the original route to `/api/v2/scan` (in order to be able to test multiple version of the scanner). For instance: `http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://www.microsoft.com/`

It returns a JSON content as the original code.

##Webjob

The webjob takes batches of websites from the configured list and sends requests to the Scan API endpoint. It collects results and errors and stores them in two files prefixed with 'results' and 'errors'.
In order to obtain early feedback, the process dumps the errors after every 100 error messages.

###Parameters

The webjob could be parametrized from command line or by reading the `ScanJob_Arguments` App Setting (configurable from the Azure Website portal).

 * `--source=<source>`: If the value is  `azure` it will use Azure storage and read the list of websites from the _websites.csv_ blob file. For any other value it will use file system instead. (Default value: _blank_ i.e. file system storage)
 * `--target=<target>`:  If the value is  `azure` it will store the results and errors in Azure blob storage. For any other value it will use file system instead. (Default value: _blank_ i.e. file system storage)
 * `--file=<filename>`: Used to set the input file name. (Default value: `websites.csv`) Depending on `source`, the name refers to local filesystem or to Azure storage.
 * `--prefix=<urlprefix>`: Used to set the Scan API endpoint url to use. We used it for development and testing purposes and can be used to redirect the load to any other environment. We now defaulted to the _production_ environment: `http://sites-scanner.azurewebsites.net/api/v2/scan?url=http://`
 * `--connections=<noconnections>`: Used to set the amount of simultaneous connection the webjob can execute to the Scan API. We found this useful while improving the scalability of the solution. (Default value: 20 connections).

##Websites and Results pages

We removed the original feature to enter and scan a single url. We replaced it with the ability to upload a website list in CSV format that will be displayed  and another page to view the results (both using jQuery Datatables.)


##Deployment

Deployment can be done in three different flavors:
 * Repository integration - You can upload the entire repo to the Azure website repository.
 * Deployment script - You can drop your publish setting file, rename it to `sites-scanner.PublishSettings` and run the ´deploy.cmd´ script. This script uses the [WAWSDeploy](https://github.com/davidebbo/WAWSDeploy) tool to upload all required files using WebDeploy.
 * Manually - As usual you can go ahead and upload the entire repository to the remote site\wwwroot\ folder via FTP.

###App Settings

Only three app settings are used by the website and the webjob

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
