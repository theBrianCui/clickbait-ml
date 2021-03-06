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

var known_urls_set = new Set();
var known_text_set = new Set();

/* Load classified texts and urls into memory. This way, it doesn't reclassify the same text again. */
(function() {
    try {
        let normal_known: Array<string> = fs.readFileSync(args[2], "utf8").split("\n").filter((text) => text !== "");
        for (let text of normal_known) {
            known_text_set.add(text);
        }

        let unknown_known: Array<string> = fs.readFileSync(args[3], "utf8").split("\n").filter((text) => text !== "");
        for (let text of unknown_known) {
            known_text_set.add(text);
        }

        let clickbait_known: Array<string> = fs.readFileSync(args[4], "utf8").split("\n").filter((text) => text !== "");
        for (let text of clickbait_known) {
            known_text_set.add(text);
        }
    } catch (e) {
        console.log("Output files do not exist, ignoring contents.");
    }
})();

var loaded = 0;

const NORMAL: fs.WriteStream = fs.createWriteStream(args[2], {flags:'a'});
const UNKNOWN: fs.WriteStream = fs.createWriteStream(args[3], {flags:'a'});
const CLICKBAIT: fs.WriteStream = fs.createWriteStream(args[4], {flags:'a'});

// print the state of the running program
function printState() {
    console.log(`Traversed ${loaded} / ${known_urls_set.size} URLs and processed ${known_text_set.size} anchor tags.`);
}

/* Read each URL in the input file. */
const input_file_lines = fs.readFileSync(INPUT, "utf8")
    .split("\n")
    .map((str: string) => { return str.trim() })
    .filter((str: string) => { return str !== "" });

input_file_lines.forEach((url) => {
    known_urls_set.add(url);
});

console.log("Loaded URLs: " + JSON.stringify(input_file_lines.slice(0, 3)) + "...");

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
function simpleClassify(anchors: Array<HTMLAnchorElement>, base_url: string,
                        clickbait_set: Set<HTMLAnchorElement>,
                        normal_set: Set<HTMLAnchorElement>): Array<string> {

    function isNormalText(text_content_concat: string): boolean {
        if (text_content_concat.split(" ").length <= 3) return true;
        let lowercase = text_content_concat.toLowerCase();

        // probably an xml tag
        if (lowercase[0] === "<")
            return true;

        const normal_contents = ["share on", "share with", "<img", "real estate",
            "on twitter", "on instagram", "on facebook", "on google+", "hotels near", "out of 5 stars",
            "camera & photo", "food & beverage", "fitness & running", "national park"];
        for (let content of normal_contents) {
            if (lowercase.indexOf(content) !== -1)
                return true;
        }

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
                            : base_url + dest_link;
        if (absolute_url.indexOf("//") === 0){
            absolute_url = absolute_url.substring(2);
        }
        if (absolute_url.indexOf("http") !== 0) {
            absolute_url = "http://" + absolute_url;
        }
        inner_urls.push(absolute_url);

        // skip links that have no text content
        let text_content: Array<string> = findTextNodes(anchor_node);
        let text_content_concat = text_content.join(" ").trim();
        if (text_content.length === 0 || text_content_concat === "") continue;

        /* ignore links that we've seen already */
        if (known_text_set.has(text_content_concat))
            continue;

        known_text_set.add(text_content_concat);

        /* if it's less than or equal to 3 words, it's normal */
        if (normal_set.has(anchor_node) || isNormalText(text_content_concat)) {
            NORMAL.write(text_content_concat +"\n");
            continue;
        }

        /* if the anchor node belongs to the clickbait_set, it's clickbait */
        if (clickbait_set.has(anchor_node)) {
            CLICKBAIT.write(text_content_concat + "\n");
            continue;
        }

        /* we don't know */
        UNKNOWN.write(text_content_concat + "\n");
    }

    return inner_urls;
}

function createRequestPromise(urls: Array<string>, depth: number): Array<Promise<any>> {
    if (depth > MAX_RECURSION_DEPTH || urls.length === 0) return [];
    let all_requests: Array<Promise<any>> = [];

    for (let i = 0; i < urls.length; ++i) {
        let url = urls[i];

        if (!known_urls_set.has(url)) {
            console.log("FATAL: known_urls did not contain " + url);
            process.exit(1);
        }

        let adapter_selectors = getKnownAdapter(url);
        let req: Promise<any> = Promise.delay(Math.floor(Math.random() * known_urls_set.size * 1000)).then(() => request({
                url: url,
                headers: {
                    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0"
                },
                timeout: 15000
        })).then((res) => {
            // render the HTML, then retrieve all the anchor tags
            return new JSDOM(res);

        }).catch((e) => {
            // if render or request failed, just render a blank page.
            console.log("An error occurred with " + url + ": " + e.toString().substring(0, 80));

            return new JSDOM("");

        }).then((dom): Promise<any> => {
            loaded++;

            /* Get all the anchor tags and keep the valid hyperlinks. */
            const anchor_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, ['a']);
            const anchor_nodes_manual: Array<HTMLAnchorElement> = Array.from(dom.window.document.querySelectorAll('a'));

            if (anchor_nodes.length === 0) return Promise.resolve([]);

            /* Run clickbait adapter queries to produce a set of anchor tags with known clickbait titles. */
            let known_clickbait_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, adapter_selectors.clickbait);
            const clickbait_set = new Set(known_clickbait_nodes);

            /* Run normal adapter queries to produce a set of anchor tags with known normal titles. */
            let known_normal_nodes: Array<HTMLAnchorElement> = selectHyperlinkNodes(dom, adapter_selectors.normal);
            const normal_set = new Set(known_normal_nodes);

            /* Classify and retrieve all the inner urls. */
            let inner_urls = simpleClassify(anchor_nodes, url, clickbait_set, normal_set);
            let next_urls = [];

            /* only visit new URLs we haven't seen before */
            if (depth < MAX_RECURSION_DEPTH) {
                for (let x = 0; x < inner_urls.length; ++x) {
                    let next_url = inner_urls[x];
                    if (!known_urls_set.has(next_url)) {
                        known_urls_set.add(next_url);
                        next_urls.push(next_url);
                    }
                }
            }
            if (loaded % 20 === 0)
                printState();

            /* Recursively search children pages with depth + 1 */
            if (next_urls.length > 0) {
                return Promise.all(createRequestPromise(next_urls, depth + 1));
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
