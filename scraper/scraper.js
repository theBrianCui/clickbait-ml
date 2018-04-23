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
var known_urls_set = new Set();
var known_text_set = new Set();
/* Load classified texts and urls into memory. This way, it doesn't reclassify the same text again. */
(function () {
    try {
        var normal_known = fs.readFileSync(args[2], "utf8").split("\n").filter(function (text) { return text !== ""; });
        for (var _i = 0, normal_known_1 = normal_known; _i < normal_known_1.length; _i++) {
            var text = normal_known_1[_i];
            known_text_set.add(JSON.parse(text).join(" "));
        }
        var unknown_known = fs.readFileSync(args[3], "utf8").split("\n").filter(function (text) { return text !== ""; });
        for (var _a = 0, unknown_known_1 = unknown_known; _a < unknown_known_1.length; _a++) {
            var text = unknown_known_1[_a];
            known_text_set.add(JSON.parse(text).join(" "));
        }
        var clickbait_known = fs.readFileSync(args[4], "utf8").split("\n").filter(function (text) { return text !== ""; });
        for (var _b = 0, clickbait_known_1 = clickbait_known; _b < clickbait_known_1.length; _b++) {
            var text = clickbait_known_1[_b];
            known_text_set.add(JSON.parse(text).join(" "));
        }
    }
    catch (e) {
        console.log("Output files do not exist, ignoring contents.");
    }
})();
var loaded = 0;
var NORMAL = fs.createWriteStream(args[2], { flags: 'a' });
var UNKNOWN = fs.createWriteStream(args[3], { flags: 'a' });
var CLICKBAIT = fs.createWriteStream(args[4], { flags: 'a' });
// print the state of the running program
function printState() {
    console.log("Traversed " + loaded + " / " + known_urls_set.size + " URLs and processed " + known_text_set.size + " anchor tags.");
}
/* Read each URL in the input file. */
var input_file_lines = fs.readFileSync(INPUT, "utf8")
    .split("\n")
    .map(function (str) { return str.trim(); })
    .filter(function (str) { return str !== ""; });
input_file_lines.forEach(function (url) {
    known_urls_set.add(url);
});
console.log("Loaded URLs: " + JSON.stringify(input_file_lines.slice(0, 3)) + "...");
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
function simpleClassify(anchors, base_url, clickbait_set, normal_set) {
    function isNormalText(text_content_concat) {
        if (text_content_concat.split(" ").length <= 3)
            return true;
        var lowercase = text_content_concat.toLowerCase();
        // probably an xml tag
        if (lowercase[0] === "<")
            return true;
        var normal_contents = ["share on", "share with", "<img", "real estate",
            "on twitter", "on instagram", "on facebook", "on google+", "hotels near", "out of 5 stars",
            "camera & photo", "food & beverage", "fitness & running", "national park"];
        for (var _i = 0, normal_contents_1 = normal_contents; _i < normal_contents_1.length; _i++) {
            var content = normal_contents_1[_i];
            if (lowercase.indexOf(content) !== -1)
                return true;
        }
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
            : base_url + dest_link;
        if (absolute_url.indexOf("//") === 0) {
            absolute_url = absolute_url.substring(2);
        }
        if (absolute_url.indexOf("http") !== 0) {
            absolute_url = "http://" + absolute_url;
        }
        inner_urls.push(absolute_url);
        // skip links that have no text content
        var text_content = findTextNodes(anchor_node);
        var text_content_concat = text_content.join(" ").trim();
        if (text_content.length === 0 || text_content_concat === "")
            continue;
        /* ignore links that we've seen already */
        if (known_text_set.has(text_content_concat))
            continue;
        known_text_set.add(text_content_concat);
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
        if (!known_urls_set.has(url)) {
            console.log("FATAL: known_urls did not contain " + url);
            process.exit(1);
        }
        var adapter_selectors = getKnownAdapter(url);
        var req = Promise.delay(Math.floor(Math.random() * known_urls_set.size * 800)).then(function () { return request({
            url: url,
            headers: {
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0"
            },
            timeout: 15000
        }); }).then(function (res) {
            // render the HTML, then retrieve all the anchor tags
            return new jsdom_1.JSDOM(res);
        })["catch"](function (e) {
            // if render or request failed, just render a blank page.
            console.log("An error occurred with " + url + ": " + e.toString().substring(0, 80));
            return new jsdom_1.JSDOM("");
        }).then(function (dom) {
            loaded++;
            /* Get all the anchor tags and keep the valid hyperlinks. */
            var anchor_nodes = selectHyperlinkNodes(dom, ['a']);
            var anchor_nodes_manual = Array.from(dom.window.document.querySelectorAll('a'));
            if (anchor_nodes.length === 0)
                return Promise.resolve([]);
            /* Run clickbait adapter queries to produce a set of anchor tags with known clickbait titles. */
            var known_clickbait_nodes = selectHyperlinkNodes(dom, adapter_selectors.clickbait);
            var clickbait_set = new Set(known_clickbait_nodes);
            /* Run normal adapter queries to produce a set of anchor tags with known normal titles. */
            var known_normal_nodes = selectHyperlinkNodes(dom, adapter_selectors.normal);
            var normal_set = new Set(known_normal_nodes);
            /* Classify and retrieve all the inner urls. */
            var inner_urls = simpleClassify(anchor_nodes, url, clickbait_set, normal_set);
            var next_urls = [];
            /* only visit new URLs we haven't seen before */
            if (depth < MAX_RECURSION_DEPTH) {
                for (var x = 0; x < inner_urls.length; ++x) {
                    var next_url = inner_urls[x];
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
