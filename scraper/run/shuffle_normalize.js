const fs = require("fs");
const shuffle = require("shuffle-array");

const CLICKBAIT_IMPORT = fs.readFileSync("clickbait.out", "utf8")
    .split("\n").map(text => text.trim()).filter(text => text !== "");
const NORMAL_IMPORT = fs.readFileSync("normal.out", "utf8")
    .split("\n").map(text => text.trim()).filter(text => text !== "");

const CLICKBAIT_DATASET_SIZE = CLICKBAIT_IMPORT.length;
console.log("Imported " + CLICKBAIT_DATASET_SIZE + " clickbait lines.");

let pick_normal_data = shuffle(NORMAL_IMPORT);
let normal_out = fs.createWriteStream("normal_selected.out");
for (let i = 0; i < CLICKBAIT_DATASET_SIZE; ++i) {
    normal_out.write(pick_normal_data[i] + "\n");
}
