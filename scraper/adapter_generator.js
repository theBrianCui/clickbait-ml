const fs = require("fs");
const args = process.argv.slice(2);

if (!args[0]) {
    console.log("Usage: adapter_generator.js INPUTFILE");
    process.exit(1);
}

const urls = (fs.readFileSync(args[0], "utf8")).split("\n")
    .map((text) => text.trim()).filter((text) => text !== "");

for (let url of urls) {
    let obj = {
        base: url,
        selectors: {
            clickbait: [],
            normal: ['a']
        }
    }

    console.log(JSON.stringify(obj) + ",");
}
