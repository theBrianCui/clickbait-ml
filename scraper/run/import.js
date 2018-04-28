const fs = require("fs");
const KNOWN_TEXT_SET = new Set();

/* Load classified texts and urls into memory. This way, it doesn't reclassify the same text again. */
(function() {
    try {
        let normal_known = fs.readFileSync("normal.out", "utf8").split("\n").filter((text) => text !== "");
        for (let text of normal_known) {
            KNOWN_TEXT_SET.add(text);
        }

        let clickbait_known = fs.readFileSync("clickbait.out", "utf8").split("\n").filter((text) => text !== "");
        for (let text of clickbait_known) {
            KNOWN_TEXT_SET.add(text);
        }
    } catch (e) {
        console.log("Output files do not exist, ignoring contents.");
    }
})();

const NORMAL = fs.createWriteStream("normal.out", {flags:'a'});
const CLICKBAIT = fs.createWriteStream("clickbait.out", {flags:'a'});

const NORMAL_IMPORT = fs.readFileSync("non_clickbait_data", "utf8").split("\n").map(text => text.trim()).filter(text => text !== "");
for (let line of NORMAL_IMPORT) {
    if (!KNOWN_TEXT_SET.has(line)) {
        KNOWN_TEXT_SET.add(line);
        NORMAL.write(line + "\n");
    }
}

const CLICKBAIT_IMPORT = fs.readFileSync("clickbait_data", "utf8").split("\n").map(text => text.trim()).filter(text => text !== "");
for (let line of CLICKBAIT_IMPORT) {
    if (!KNOWN_TEXT_SET.has(line)) {
        KNOWN_TEXT_SET.add(line);
        CLICKBAIT.write(line + "\n");
    }
}
