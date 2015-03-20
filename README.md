# Distributed Scan

## Configuration

## Deployment

## How it works

The scan job can be launched....

## Installation and configuration

## Testing

The project contains a set of unit tests in the `/test/` directory. To run the unit tests, type `grunt nodeunit`.

## JSON output

Once the scan completes, it produces a set of scan results in JSON format:
```js
{
    "testName" : {
        "testName": "Short description of the test",
        "passed" : true/false,
        "data": { /* optional data describing the results found */ }
    }
}
```

The `data` property will vary depending on the test, but will generally provide further detail about any issues found.
