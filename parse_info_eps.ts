import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync("info.html", "utf-8");
const $ = cheerio.load(html);

console.log("Episodes div found:", $(".episodes").length);
console.log("Servers div found:", $(".servers").length);
console.log("List of episode links:");
$(".episodes a").each((i, el) => {
  console.log($(el).attr("href"), $(el).attr("data-id"));
});
