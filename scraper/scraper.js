"use strict";
exports.__esModule = true;
/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
var fs = require("fs");
var jsdom_1 = require("jsdom");
var request = require("request-promise");
var args = process.argv.slice(2);
if (!args[0]) {
    console.log("Usage: node scraper.js INPUTFILE");
    process.exit(1);
}
// read each url line by line
var input_file_lines = fs.readFileSync(args[0], "utf8")
    .split("\n")
    .map(function (str) { return str.trim(); })
    .filter(function (str) { return str !== ""; });
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
// retrieve each page and prints its links, asynchronously
input_file_lines.forEach(function (url) {
    request("https://www." + url).then(function (res) {
        // render the HTML, then retrieve all the anchor tags
        var dom = new jsdom_1.JSDOM(res);
        var anchor_nodes = Array.from(dom.window.document.querySelectorAll('a'));
        for (var i = 0; i < anchor_nodes.length; ++i) {
            var anchor_node = anchor_nodes[i];
            var dest_link = anchor_node.href.trim();
            // skip destination links that are empty or start with javascript:
            if (!dest_link || dest_link.indexOf("javascript:") === 0)
                continue;
            // skip links that have no text content
            var text_content = findTextNodes(anchor_node);
            if (text_content.length === 0 || text_content.join("").trim() === "")
                continue;
            console.log(dest_link + " : " + JSON.stringify(text_content));
        }
    });
});
