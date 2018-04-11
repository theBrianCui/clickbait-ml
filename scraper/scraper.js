"use strict";
exports.__esModule = true;
/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
var fs = require("fs");
var jsdom_1 = require("jsdom");
var request = require("request-promise");
var Promise = require("bluebird");
var args = process.argv.slice(2);
if (!args[0]) {
    console.log("Usage: node scraper.js INPUTFILE [recursion-depth]");
    process.exit(1);
}
// read each url line by line
var input_file_lines = fs.readFileSync(args[0], "utf8")
    .split("\n")
    .map(function (str) { return str.trim(); })
    .filter(function (str) { return str !== ""; });
var MAX_RECURSION_DEPTH = parseInt(args[1], 10) || 0;
var ABSOLUTE_URL_REGEX = new RegExp('^(?:[a-z]+:)?//', 'i');
function findTextNodes(root) {
    var text_content = root.textContent.split("\n")
        .map(function (str) { return str.trim(); })
        .filter(function (str) { return str !== ""; });
    /*
    if (root.children.length > 0) {
        for (let i = 0; i < root.children.length; ++i) {
            text_content.concat(findTextNodes(root.children[i] as HTMLElement));
        }
    } else {
        text_content.concat([root.textContent])
    }
    */
    return text_content;
}
function validHyperlinkNode(node) {
    var dest_link = node.href.trim();
    return dest_link &&
        dest_link.indexOf("javascript:") !== 0 &&
        dest_link.indexOf("about:") !== 0;
}
function createRequestPromise(urls, depth) {
    if (depth === void 0) { depth = 0; }
    if (depth > MAX_RECURSION_DEPTH || urls.length === 0)
        return [];
    var all_requests = [];
    var _loop_1 = function (i) {
        var url = urls[i];
        var req = request(url).then(function (res) {
            // render the HTML, then retrieve all the anchor tags
            return new jsdom_1.JSDOM(res);
        })["catch"](function (e) {
            // if render failed, just render a blank page.
            return new jsdom_1.JSDOM("");
        }).then(function (dom) {
            var anchor_nodes = Array.from(dom.window.document.querySelectorAll('a'))
                .filter(validHyperlinkNode);
            if (anchor_nodes.length === 0)
                return [];
            var inner_urls = [];
            for (var i_1 = 0; i_1 < anchor_nodes.length; ++i_1) {
                var anchor_node = anchor_nodes[i_1];
                var dest_link = anchor_node.href.trim();
                // skip links that have no text content
                var text_content = findTextNodes(anchor_node);
                if (text_content.length === 0 || text_content.join("").trim() === "")
                    continue;
                console.log(url + " (" + depth + ") : " + JSON.stringify(text_content) + ",");
                // push absolute urls to inner_urls
                if (ABSOLUTE_URL_REGEX.test(dest_link)) {
                    inner_urls.push(dest_link);
                }
                else {
                    inner_urls.push("https://" + dest_link);
                }
            }
            return inner_urls;
        }).then(function (inner_urls) {
            // recursively search children pages with depth + 1
            return Promise.all(createRequestPromise(inner_urls, depth + 1));
        });
        all_requests.push(req);
    };
    for (var i = 0; i < urls.length; ++i) {
        _loop_1(i);
    }
    return all_requests;
}
// retrieve each page and prints its links, asynchronously
Promise.all(createRequestPromise(input_file_lines)).then(function () {
    console.log("DONE!");
});
