"use strict";
exports.__esModule = true;
/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
var fs = require("fs");
var jsdom_1 = require("jsdom");
var request = require("request-promise");
var Promise = require("bluebird");
var ABSOLUTE_URL_REGEX = new RegExp('^(?:[a-z]+:)?//', 'i');
var args = process.argv.slice(2);
if (!args[0] || !args[2] || !args[3] || !args[4]) {
    console.log("Usage: node scraper.js INPUTFILE ADAPTERS");
    console.log("NORMAL UNKNOWN CLICKBAIT [recursion-depth=0]");
    process.exit(1);
}
/* Read arguments, including filenames of input and output files. Output files are write streams. */
var INPUT = args[0];
/* Adapters are specific CSS selectors for specific base URLs. They let us manually indicate specific
    anchor tags as being clickbait or normal. */
var ADAPTERS = require("./" + args[1]);
var ADAPTER_URLS = ADAPTERS.map(function (adapter) { return adapter.base; });
var ADAPTER_SELECTORS = ADAPTERS.map(function (adapter) { return adapter.selectors; });
/* Maximum recursion depth. Defaults to 0. */
var MAX_RECURSION_DEPTH = parseInt(args[5], 10) || 0;
function getKnownAdapter(url) {
    for (var i = 0; i < ADAPTER_URLS.length; ++i) {
        var adapter_url = ADAPTER_URLS[i];
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
    };
}
var NORMAL = fs.createWriteStream(args[2]);
var UNKNOWN = fs.createWriteStream(args[3]);
var CLICKBAIT = fs.createWriteStream(args[4]);
var visited_url_set = new Set();
var known_text = new Set();
var loaded = 0;
// print the state of the running program
function printState() {
    console.log("Traversed " + loaded + " / " + visited_url_set.size + " URLs and processed " + known_text.size + " anchor tags.");
}
/* Read each URL in the input file. */
var input_file_lines = fs.readFileSync(INPUT, "utf8")
    .split("\n")
    .map(function (str) { return str.trim(); })
    .filter(function (str) { return str !== ""; });
input_file_lines.forEach(function (url) {
    visited_url_set.add(url);
});
/* Retrieve the inner textNodes of a given HTMLElement.
    The .textContent property is inherently recursive, but the results are concatenated.
    To retrieve the nodes separately, we split on \n, trim the results, and ignore blanks. */
function findTextNodes(root) {
    var text_content = root.textContent.split("\n")
        .map(function (str) { return str.trim(); })
        .filter(function (str) { return str !== ""; });
    return text_content;
}
/* A valid hyperlink is one that points to another HTTP page. */
function validHyperlinkNode(node) {
    var dest_link = node.href.trim();
    return dest_link &&
        dest_link.indexOf("javascript:") !== 0 &&
        dest_link.indexOf("about:") !== 0;
}
/* Retrieve a list of valid hyperlink nodes by selector. */
function selectHyperlinkNodes(dom, selectors) {
    var hyperlinks = [];
    for (var i = 0; i < selectors.length; ++i) {
        hyperlinks = hyperlinks.concat(Array.from(dom.window.document.querySelectorAll(selectors[i])).filter(validHyperlinkNode));
    }
    return hyperlinks;
}
/* Perform a simple classification. Return an array of absolute urls to traverse next. */
function simpleClassify(anchors, clickbait_set, normal_set) {
    function isNormalText(text_content_concat) {
        if (text_content_concat.split(" ").length <= 3)
            return true;
        var lowercase = text_content_concat.toLowerCase();
        if (lowercase.indexOf("Share on") !== -1 || lowercase.indexOf("Share with") !== -1)
            return true;
        if (lowercase.indexOf("<img") === 0)
            return true;
        var SOCIAL_MEDIA = ['facebook', 'twitter', 'google+', 'google'];
        for (var i = 0; i < SOCIAL_MEDIA.length; ++i) {
            if (SOCIAL_MEDIA[i] === lowercase)
                return true;
        }
        return false;
    }
    var inner_urls = [];
    for (var i = 0; i < anchors.length; ++i) {
        var anchor_node = anchors[i];
        var dest_link = anchor_node.href.trim();
        /* Relative URLs should be converted to absolute URLs as the canonical form. */
        var absolute_url = ABSOLUTE_URL_REGEX.test(dest_link) ? dest_link
            : "https://" + dest_link;
        inner_urls.push(absolute_url);
        // skip links that have no text content
        var text_content = findTextNodes(anchor_node);
        var text_content_concat = text_content.join(" ").trim();
        if (text_content.length === 0 || text_content_concat === "")
            continue;
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
function createRequestPromise(urls, depth) {
    if (depth > MAX_RECURSION_DEPTH || urls.length === 0)
        return [];
    var all_requests = [];
    var _loop_1 = function (i) {
        var url = urls[i];
        var adapter_selectors = getKnownAdapter(url);
        var req = request({
            url: url,
            timeout: 15000
        }).then(function (res) {
            // render the HTML, then retrieve all the anchor tags
            return new jsdom_1.JSDOM(res);
        })["catch"](function (e) {
            // if render failed, just render a blank page.
            return new jsdom_1.JSDOM("");
        }).then(function (dom) {
            loaded++;
            /* Get all the anchor tags and keep the valid hyperlinks. */
            var anchor_nodes = selectHyperlinkNodes(dom, ['a']);
            if (anchor_nodes.length === 0)
                return Promise.resolve([]);
            /* Run clickbait adapter queries to produce a set of anchor tags with known clickbait titles. */
            var known_clickbait_nodes = selectHyperlinkNodes(dom, adapter_selectors.clickbait);
            var clickbait_set = new Set(known_clickbait_nodes);
            /* Run normal adapter queries to produce a set of anchor tags with known normal titles. */
            var known_normal_nodes = selectHyperlinkNodes(dom, adapter_selectors.normal);
            var normal_set = new Set(known_normal_nodes);
            /* Classify and retrieve all the inner urls. */
            var inner_urls = simpleClassify(anchor_nodes, clickbait_set, normal_set);
            /* only visit new URLs we haven't seen before */
            if (depth < MAX_RECURSION_DEPTH) {
                inner_urls.filter(function (inner_url) {
                    return !visited_url_set.has(inner_url);
                }).forEach(function (inner_url) {
                    visited_url_set.add(inner_url);
                });
            }
            else {
                inner_urls = [];
            }
            visited_url_set.add(url);
            if (loaded % 20 === 0)
                printState();
            /* Recursively search children pages with depth + 1 */
            if (inner_urls.length > 0) {
                return Promise.all(createRequestPromise(inner_urls, depth + 1));
            }
            else {
                return Promise.resolve([]);
            }
        })["catch"](function (e) {
            console.log("Error: " + url + " : " + e);
            return [];
        });
        all_requests.push(req);
    };
    for (var i = 0; i < urls.length; ++i) {
        _loop_1(i);
    }
    return all_requests;
}
var all = createRequestPromise(input_file_lines, 0);
var updates = setInterval(function () {
    printState();
}, 2000);
Promise.all(all).then(function () {
    clearInterval(updates);
    printState();
    console.log("Done.");
});
