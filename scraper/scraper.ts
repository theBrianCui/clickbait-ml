/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import fs = require("fs");
import { JSDOM } from "jsdom";
import request = require("request-promise");
import Promise = require("bluebird");

const args: Array<string> = process.argv.slice(2);
if (!args[0]) {
    console.log("Usage: node scraper.js INPUTFILE");
    process.exit(1);
}

// read each url line by line
const input_file_lines = fs.readFileSync(args[0], "utf8")
    .split("\n")
    .map((str: string) => { return str.trim() })
    .filter((str: string) => { return str !== "" });

function findTextNodes(root: HTMLElement): Array<string> {
    let text_content: Array<string> = 
        root.textContent.split("\n")
            .map((str: string) => { return str.trim() })
            .filter((str: string) => { return str !== "" });

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
input_file_lines.forEach((url) => {
    request("https://www." + url).then((res) => {
        // render the HTML, then retrieve all the anchor tags
        const dom: JSDOM = new JSDOM(res);
        const anchor_nodes: Array<HTMLAnchorElement> = Array.from(dom.window.document.querySelectorAll('a'));
    
        for (let i = 0; i < anchor_nodes.length; ++i) {
            let anchor_node = anchor_nodes[i];
            let dest_link: string = anchor_node.href.trim();
     
            // skip destination links that are empty or start with javascript:
            if (!dest_link || dest_link.indexOf("javascript:") === 0) continue;
    
            // skip links that have no text content
            let text_content: Array<string> = findTextNodes(anchor_node);
            if (text_content.length === 0 || text_content.join("").trim() === "") continue;
            
            console.log(dest_link + " : " + JSON.stringify(text_content));
        }
    });
})
