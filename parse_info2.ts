import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync("info.html", "utf-8");
const $ = cheerio.load(html);
console.log($('body').html()?.slice(0, 1000));
console.log($('script').map((i, el) => $(el).html()?.slice(0, 50)).get().join('\n'));
