# Anchor Tag Scraper

This program scrapes webpages for anchor (`<a>`) tags and associates their destinations (`href`) with the text content of the links.

This scraper was written using [TypeScript](http://www.typescriptlang.org/). If you don't have the TypeScript compiler `tsc` yet, install it now. Although not required, we recommend using [Visual Studio Code](https://code.visualstudio.com) for type inference and code completion features.

## Usage

```
Usage: node scraper.js INPUTFILE ADAPTERS NORMAL UNKNOWN CLICKBAIT [recursion-depth=0]
```

`INPUTFILE` is a newline separated list of hyperlinks. `ADAPTERS` is a hand written JSON file that includes specific clickbait CSS selectors. `NORMAL`, `UNKNOWN`, and `CLICKBAIT` are output files, where `NORMAL` are link texts deemd to not be clickbait, `UNKNOWN` are link texts that have an unspecified classification, and `CLICKBAIT` are link texts that are known to be clickbait.

The final `recursion-depth` parameter accepts a number, though the default of `0` is recommended.

## Developer Setup

Start by installing the typescript compiler `tsc` globally. This only has to be performed once per machine.
```
sudo npm install -g typescript
```

Then, install the necessary project dependencies.
```
npm install
```

Before running, make sure to compile the project with:
```
tsc
```
