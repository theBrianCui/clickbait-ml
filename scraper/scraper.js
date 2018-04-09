"use strict";
exports.__esModule = true;
/// <reference path="./node_modules/@types/jsdom/index.d.ts"/>
var jsdom_1 = require("jsdom");
/// <reference path="./node_modules/@types/request-promise/index.d.ts"/>
var request = require("request-promise");
var dom = new jsdom_1.JSDOM("<!DOCTYPE html><p>Hello world</p>");
request("https://www.reddit.com").then(function (res) {
    console.log(res);
});
//console.log(dom.window.document.querySelector("p").textContent); // "Hello world"
