/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import { JSDOM } from "jsdom";
import request = require("request-promise");
import Promise = require("bluebird");

const dom: JSDOM = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);

function findTextNodes(root: HTMLElement): Array<String> {
    let text_content: Array<String> = 
        root.textContent.split("\n")
            .map((str: String) => { return str.trim() })
            .filter((str: String) => { return str !== "" });

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

request("https://www.buzzfeed.com/lol/").then((res) => {
    const dom: JSDOM = new JSDOM(res);
    const anchor_nodes: Array<HTMLAnchorElement> = Array.from(dom.window.document.querySelectorAll('a'));

    for (let i = 0; i < anchor_nodes.length; ++i) {
        let anchor_node = anchor_nodes[i];
        let dest_link: String = anchor_node.href.trim();
 
        // skip destination links that are empty or start with javascript:
        if (!dest_link || dest_link.indexOf("javascript:") === 0) continue;

        // skip links that have no text content
        let text_content: Array<String> = findTextNodes(anchor_node);
        if (text_content.length === 0 || text_content.join("").trim() === "") continue;
        
        console.log(dest_link + " : " + JSON.stringify(text_content));
    }
});
//console.log(dom.window.document.querySelector("p").textContent); // "Hello world"