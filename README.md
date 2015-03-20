# Distributed Scan

## Configuration

## Deployment

## How it works

The scan job can be launched....

## Installation and configuration

## Testing

The project contains a set of unit tests in the `/test/` directory. To run the unit tests, type `grunt nodeunit`.

## Plugins 

```json
{
    "allowFlash": true,
    "allowSilverlight": true,
    "allowOthers": false
}
```

## Whitelist

TBD

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

## Scan Job Arguments

TBD

- `--file=<filename>`: the file with the web site list to process. Depending on `source`, the name refers to local filesystem or to Azure storage
- `--prefix=<urlprefix>`: the URL to use as prefix to service entry point. Example: `http://sites-scanner-test.azurewebsites.net/api/v2/scan?url=http://`
- `--source=<source>`: if source=azure, the web site list is retrieved from Azure storage, from `dailyscan` container. In other case, the filename refers to local filesystem, current directory is the scan job one.
- `--target=<target>`: if target=azure, the results and errors files are saved on Azure storage. In other case, they are saved on local filesystem

