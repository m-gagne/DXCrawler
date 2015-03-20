# Distributed Scan

## Configuration

## Deployment

## How it works

The scan job can be launched....

## Installation and configuration

## Testing

The project contains a set of unit tests in the `/test/` directory. To run the unit tests, type `grunt nodeunit`.

## Plugins 

The file `lib\checks\check-pluginfree.json`:

```json
{
    "allowFlash": true,
    "allowSilverlight": true,
    "allowOthers": false
}
```

If you modify this file, you should restart the service to take the changes into account.

## Whitelist

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

## Scan Job Arguments

TBD

- `--file=<filename>`: the file with the web site list to process. Depending on `source`, the name refers to local filesystem or to Azure storage. Default value: `websites.csv`
- `--prefix=<urlprefix>`: the URL to use as prefix to service entry point. Example: `http://sites-scanner-test.azurewebsites.net/api/v2/scan?url=http://`
- `--source=<source>`: if source=azure, the web site list is retrieved from Azure storage, from `dailyscan` container. In other case, the filename refers to local filesystem, current directory is the scan job one. Default value: `azure`
- `--target=<target>`: if target=azure, the results and errors files are saved on Azure storage. In other case, they are saved on local filesystem. Default value: `azure`
- `--target=<target>`: if target=azure, the results and errors files are saved on Azure storage. In other case, they are saved on local filesystem. Default value: `azure`
- `--connections=<noconnections>`: number of simultaneous request sent by scan job to scan API. It should adjusted to the number of machines in your subscription. Default value: `20`

