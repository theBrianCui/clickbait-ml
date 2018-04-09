/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
import { JSDOM } from "jsdom";

/// <reference path="./node_modules/@types/request-promise/index.d.ts"/>
import request = require("request-promise");
import Promise = require("bluebird");

const dom: JSDOM = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);

request("https://www.reddit.com").then((res) => {
    console.log(res);
});
//console.log(dom.window.document.querySelector("p").textContent); // "Hello world"