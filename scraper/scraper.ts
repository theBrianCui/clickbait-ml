/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import fs = require("fs");
import { JSDOM } from "jsdom";
import request = require("request-promise");
import Promise = require("bluebird");
const ABSOLUTE_URL_REGEX: RegExp = new RegExp('^(?:[a-z]+:)?//', 'i');

/* The three possible classifications */
enum Class {
    NORMAL = 1,
    UNKNOWN = 2,
    CLICKBAIT = 3
};

const args: Array<string> = process.argv.slice(2);
if (!args[0] || !args[2] || !args[3] || !args[4]) {
    console.log("Usage: node scraper.js INPUTFILE ADAPTERS");
    console.log("NORMAL UNKNOWN CLICKBAIT [recursion-depth=0]");
    process.exit(1);
}

/* Read arguments, including filenames of input and output files. Output files are write streams. */
const INPUT: string = args[0];
const ADAPTERS: Array<Object> = require("./" + args[1]);
const ADAPTERS_URLS: Array<string> = ADAPTERS.map((adapter) => { return adapter["base"]; });
const ADAPTERS_SELECTORS: Array<Array<string>> = ADAPTERS.map((adapter) => { return adapter["selectors"]; });
const MAX_RECURSION_DEPTH: number = parseInt(args[5], 10) || 0;

function getKnownAdapter(url: string): Array<string> {
    for (let i = 0; i < ADAPTERS_URLS.length; ++i) {
        const adapter = ADAPTERS_URLS[i];
        if (url.indexOf(adapter) !== -1) {
            return ADAPTERS_SELECTORS[i];
        }
    }
    return [];
}

const NORMAL: fs.WriteStream = fs.createWriteStream(args[2]);
const UNKNOWN: fs.WriteStream = fs.createWriteStream(args[3]);
const CLICKBAIT: fs.WriteStream = fs.createWriteStream(args[4]);

var visited_url_set = {};
var known_text = {};

/* Read each URL in the input file. */
const input_file_lines = fs.readFileSync(INPUT, "utf8")
    .split("\n")
    .map((str: string) => { return str.trim() })
    .filter((str: string) => { return str !== "" });

input_file_lines.forEach((url) => {
    visited_url_set[url] = true;
});

/* Retrieve the inner textNodes of a given HTMLElement.
    The .textContent property is inherently recursive, but the results are concatenated.
    To retrieve the nodes separately, we split on \n, trim the results, and ignore blanks. */
function findTextNodes(root: HTMLElement): Array<string> {
    let text_content: Array<string> =
        root.textContent.split("\n")
            .map((str: string) => { return str.trim() })
            .filter((str: string) => { return str !== "" });

    return text_content;
}

/* A valid hyperlink is one that points to another HTTP page. */
function validHyperlinkNode(node: HTMLAnchorElement): boolean {
    let dest_link: string = node.href.trim();
    return dest_link &&
        dest_link.indexOf("javascript:") !== 0 &&
        dest_link.indexOf("about:") !== 0;
}

/* Perform a simple classification. Return an array of absolute urls to traverse next. */
function simpleClassify(anchors: Array<HTMLAnchorElement>, clickbait_set: Set<HTMLAnchorElement>): Array<string> {
    let inner_urls: Array<string> = [];
    for (let i = 0; i < anchors.length; ++i) {
        let anchor_node = anchors[i];
        let dest_link = anchor_node.href.trim();

        /* Relative URLs should be converted to absolute URLs as the canonical form. */
        let absolute_url = ABSOLUTE_URL_REGEX.test(dest_link) ? dest_link 
                            : "https://" + dest_link;

        // skip links that have no text content
        let text_content: Array<string> = findTextNodes(anchor_node);
        let text_content_concat = text_content.join("").trim();
        if (text_content.length === 0 || text_content_concat === "") continue;

        /* ignore links that we've seen already */
        if (known_text[text_content_concat])
            continue;
        known_text[text_content_concat] = true;

        /* if the anchor node belongs to the clickbait_set, it's clickbait */
        if (clickbait_set.has(anchor_node)) {
            CLICKBAIT.write(JSON.stringify(text_content) + "\n");
            continue;
        }

        /* if it's less than or equal to 4 words, it's normal */
        if (text_content_concat.split(" ").length <= 4) {
            NORMAL.write(JSON.stringify(text_content) + "\n");
            continue;
        }

        /* we don't know */
        UNKNOWN.write(JSON.stringify(text_content) + "\n");
        inner_urls.push(absolute_url);
    }

    return inner_urls;
}

function createRequestPromise(urls: Array<string>, depth: number = 0): Array<Promise<any>> {
    if (depth > MAX_RECURSION_DEPTH || urls.length === 0) return [];
    let all_requests: Array<Promise<any>> = [];

    for (let i = 0; i < urls.length; ++i) {
        let url = urls[i];
        let adapter_selectors = getKnownAdapter(url);
        let req: Promise<any> = request(url).then((res) => {
            // render the HTML, then retrieve all the anchor tags
            return new JSDOM(res);

        }).catch((e) => {
            // if render failed, just render a blank page.
            return new JSDOM("");

        }).then((dom): Array<string> => {
            /* Get all the anchor tags and keep the valid hyperlinks. */
            const anchor_nodes: Array<HTMLAnchorElement> = Array.from(dom.window.document.querySelectorAll('a'))
                .filter(validHyperlinkNode);
            if (anchor_nodes.length === 0) return [];

            /* Run all adapter queries to produce a set of anchor tags with known clickbait titles. */
            let known_clickbait_nodes: Array<HTMLAnchorElement> = [];
            for (let k = 0; k < adapter_selectors.length; ++k) {
                let clickbait_nodes = Array.from(dom.window.document.querySelectorAll(adapter_selectors[k])) as Array<HTMLAnchorElement>;
                //console.log(clickbait_nodes);
                known_clickbait_nodes = known_clickbait_nodes.concat(clickbait_nodes);
            }

            console.log(`url: ${url}, adapter_selectors: ${adapter_selectors}, sample: ${known_clickbait_nodes}`);
            const clickbait_set = new Set(known_clickbait_nodes);
            //console.log(known_clickbait_nodes);

            /* Classify and retrieve all the inner urls. */
            let inner_urls = simpleClassify(anchor_nodes, clickbait_set);

            /* only visit new URLs we haven't seen before */
            if (depth < MAX_RECURSION_DEPTH) {
                inner_urls.filter((url) => {
                    return !visited_url_set[url];
                }).forEach((url) => {
                    visited_url_set[url] = true;
                });
            } else {
                inner_urls = [];
            }

            return inner_urls;

        }).then((inner_urls: Array<string>) => {
            /* Recursively search children pages with depth + 1 */
            if (inner_urls.length > 0) {
                return Promise.all(createRequestPromise(inner_urls, depth + 1));
            } else {
                return [];
            }
        });

        all_requests.push(req);
    }

    return all_requests;
}

// retrieve each page and prints its links, asynchronously
Promise.all(createRequestPromise(input_file_lines)).then(() => {
    console.log(`Done. Traversed ${Object.keys(visited_url_set).length} URLs and processed ${Object.keys(known_text).length} anchor tags.`);
});