/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import fs = require("fs");
import { JSDOM } from "jsdom";
import request = require("request-promise");
import Promise = require("bluebird");
const ABSOLUTE_URL_REGEX: RegExp = new RegExp('^(?:[a-z]+:)?//', 'i');

interface Adapter {
    base: string,
    selectors: {
        clickbait: Array<string>,
        normal: Array<string>
    }
}

const args: Array<string> = process.argv.slice(2);
if (!args[0] || !args[2] || !args[3] || !args[4]) {
    console.log("Usage: node scraper.js INPUTFILE ADAPTERS");
    console.log("NORMAL UNKNOWN CLICKBAIT [recursion-depth=0]");
    process.exit(1);
}

/* Read arguments, including filenames of input and output files. Output files are write streams. */
const INPUT: string = args[0];

/* Adapters are specific CSS selectors for specific base URLs. They let us manually indicate specific
    anchor tags as being clickbait or normal. */
const ADAPTERS: Array<Adapter> = require("./" + args[1]);
const ADAPTER_URLS: Array<string> = ADAPTERS.map((adapter) => { return adapter.base; });
const ADAPTER_SELECTORS = ADAPTERS.map((adapter) => { return adapter.selectors; });

/* Maximum recursion depth. Defaults to 0. */
const MAX_RECURSION_DEPTH: number = parseInt(args[5], 10) || 0;

function getKnownAdapter(url: string): Adapter["selectors"] {
    for (let i = 0; i < ADAPTER_URLS.length; ++i) {
        const adapter_url = ADAPTER_URLS[i];
        if (url.indexOf(adapter_url) === -1)
            continue;

        if (!ADAPTER_SELECTORS[i].clickbait)
            ADAPTER_SELECTORS[i].clickbait = [];
        if (!ADAPTER_SELECTORS[i].normal)
            ADAPTER_SELECTORS[i].normal = [];

        return ADAPTER_SELECTORS[i];
    }

    return {
        clickbait: [],
        normal: []
    }
}

const NORMAL: fs.WriteStream = fs.createWriteStream(args[2]);
const UNKNOWN: fs.WriteStream = fs.createWriteStream(args[3]);
const CLICKBAIT: fs.WriteStream = fs.createWriteStream(args[4]);

var visited_url_set = new Set();
var known_text = new Set();
var loaded = 0;

// print the state of the running program
function printState() {
    console.log(`Traversed ${loaded} / ${visited_url_set.size} URLs and processed ${known_text.size} anchor tags.`);
}

/* Read each URL in the input file. */
const input_file_lines = fs.readFileSync(INPUT, "utf8")
    .split("\n")
    .map((str: string) => { return str.trim() })
    .filter((str: string) => { return str !== "" });

input_file_lines.forEach((url) => {
    visited_url_set.add(url);
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

/* Retrieve a list of valid hyperlink nodes by selector. */
function selectHyperlinkNodes(dom: JSDOM, selectors: Array<string>): Array<HTMLAnchorElement> {
    let hyperlinks = [];
    for (let i = 0; i < selectors.length; ++i) {
        hyperlinks = hyperlinks.concat(
            Array.from(dom.window.document.querySelectorAll(selectors[i])).filter(validHyperlinkNode));
    }
    return hyperlinks;
}

/* Perform a simple classification. Return an array of absolute urls to traverse next. */
function simpleClassify(anchors: Array<HTMLAnchorElement>,
                        clickbait_set: Set<HTMLAnchorElement>,
                        normal_set: Set<HTMLAnchorElement>): Array<string> {

    function isNormalText(text_content_concat: string): boolean {
        if (text_content_concat.split(" ").length <= 3) return true;
        let lowercase = text_content_concat.toLowerCase();
        if (lowercase.indexOf("Share on") !== -1 || lowercase.indexOf("Share with") !== -1)
            return true;
        if (lowercase.indexOf("<img") === 0)
            return true;

        const SOCIAL_MEDIA = ['facebook', 'twitter', 'google+', 'google'];
        for (let i = 0; i < SOCIAL_MEDIA.length; ++i) {
            if (SOCIAL_MEDIA[i] === lowercase)
                return true;
        }

        return false;
    }

    let inner_urls: Array<string> = [];
    for (let i = 0; i < anchors.length; ++i) {
        let anchor_node = anchors[i];
        let dest_link = anchor_node.href.trim();

        /* Relative URLs should be converted to absolute URLs as the canonical form. */
        let absolute_url = ABSOLUTE_URL_REGEX.test(dest_link) ? dest_link
                            : "https://" + dest_link;
        inner_urls.push(absolute_url);

        // skip links that have no text content
        let text_content: Array<string> = findTextNodes(anchor_node);
        let text_content_concat = text_content.join(" ").trim();
        if (text_content.length === 0 || text_content_concat === "") continue;

        /* ignore links that we've seen already */
        if (known_text.has(text_content_concat))
            continue;

        known_text.add(text_content_concat);

        /* if it's less than or equal to 3 words, it's normal */
        if (normal_set.has(anchor_node) || isNormalText(text_content_concat)) {
            NORMAL.write(JSON.stringify(text_content) + "\n");
            continue;
        }

        /* if the anchor node belongs to the clickbait_set, it's clickbait */
        if (clickbait_set.has(anchor_node)) {
            CLICKBAIT.write(JSON.stringify(text_content) + "\n");
            continue;
        }

        /* we don't know */
        UNKNOWN.write(JSON.stringify(text_content) + "\n");
    }

    return inner_urls;
}

function createRequestPromise(urls: Array<string>, depth: number): Array<Promise<any>> {
    if (depth > MAX_RECURSION_DEPTH || urls.length === 0) return [];
    let all_requests: Array<Promise<any>> = [];

    for (let i = 0; i < urls.length; ++i) {
        let url = urls[i];
        let adapter_selectors = getKnownAdapter(url);
        let req: Promise<any> = request({
                url: url,
                timeout: 15000,
        }).then((res) => {
            // render the HTML, then retrieve all the anchor tags
            return new JSDOM(res);

        }).catch((e) => {
            // if render failed, just render a blank page.
            return new JSDOM("");

        }).then((dom): Promise<any> => {
            loaded++;

            /* Get all the anchor tags and keep the valid hyperlinks. */
            const anchor_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, ['a']);
            if (anchor_nodes.length === 0) return Promise.resolve([]);

            /* Run clickbait adapter queries to produce a set of anchor tags with known clickbait titles. */
            let known_clickbait_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, adapter_selectors.clickbait);
            const clickbait_set = new Set(known_clickbait_nodes);

            /* Run normal adapter queries to produce a set of anchor tags with known normal titles. */
            let known_normal_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, adapter_selectors.normal);
            const normal_set = new Set(known_normal_nodes);

            /* Classify and retrieve all the inner urls. */
            let inner_urls = simpleClassify(anchor_nodes, clickbait_set, normal_set);

            /* only visit new URLs we haven't seen before */
            if (depth < MAX_RECURSION_DEPTH) {
                inner_urls.filter((inner_url) => {
                    return !visited_url_set.has(inner_url);
                }).forEach((inner_url) => {
                    visited_url_set.add(inner_url);
                });
            } else {
                inner_urls = [];
            }

            visited_url_set.add(url);
            if (loaded % 20 === 0)
                printState();

            /* Recursively search children pages with depth + 1 */
            if (inner_urls.length > 0) {
                return Promise.all(createRequestPromise(inner_urls, depth + 1));
            } else {
                return Promise.resolve([]);
            }

        }).catch((e) => {
            console.log(`Error: ${url} : ${e}`);
            return [];

        });

        all_requests.push(req);
    }

    return all_requests;
}

let all = createRequestPromise(input_file_lines, 0);
let updates = setInterval(() => {
    printState();
}, 2000);

Promise.all(all).then(() => {
    clearInterval(updates);
    printState();
    console.log("Done.");
});
