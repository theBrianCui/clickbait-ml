/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import { JSDOM } from "jsdom";
import request = require("request-promise");
import Promise = require("bluebird");

const dom: JSDOM = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);

function findTextNodes(root: HTMLElement): Array<String> {
    let text_content: Array<String> = [root.textContent];

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

request("https://www.reddit.com").then((res) => {
    const dom: JSDOM = new JSDOM(res);
    const anchor_nodes: Array<HTMLAnchorElement> = Array.from(dom.window.document.querySelectorAll('a'));

    for (let i = 0; i < anchor_nodes.length; ++i) {
        let anchor_node = anchor_nodes[i];
        let output: String = anchor_node.href;
        if (!output) continue;
        
        console.log(output + " : " + JSON.stringify(findTextNodes(anchor_node)));
    }
});
//console.log(dom.window.document.querySelector("p").textContent); // "Hello world"