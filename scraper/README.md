# Anchor Tag Scraper

This program scrapes webpages for anchor (`<a>`) tags and associates their destinations (`href`) with the text content of the links.

This scraper was written using [TypeScript](http://www.typescriptlang.org/). If you don't have the TypeScript compiler `tsc` yet, install it now. Although not required, we recommend using [Visual Studio Code](https://code.visualstudio.com) for type inference and code completion features.

## Usage

```
node scraper.js INPUTFILE
```

`INPUTFILE` is a newline separated list of hyperlinks.

## Developer Setup

```
sudo npm install -g typescript
```

Then, install the necessary project dependencies.

```
npm install
```

Compile the project with:
```
tsc
```
