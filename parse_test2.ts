import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync("search.html", "utf-8");
const $ = cheerio.load(html);

console.log($('.item').first().html());
