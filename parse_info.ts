import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync("info.html", "utf-8");
const $ = cheerio.load(html);

console.log("Title:", $('h1.title').text().trim(), $('.title').text().trim());
console.log("Episodes:", $('#episodes').html()?.slice(0, 100));

// Find anything about episodes
console.log("Episode links count:", $('a[data-ep]').length, $('a[href*="/ep-"]').length);

// Just print episode container
console.log("ep-list", $('.ep-list').html()?.slice(0, 200));
console.log("episodes main", $('#episodes').length ? "Has #episodes" : "No #episodes");
