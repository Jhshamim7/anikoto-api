import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync("search.html", "utf-8");
const $ = cheerio.load(html);

console.log("Total items:", $('.item').length, $('.flw-item').length, $('.film_list-wrap .flw-item').length);
$('.flw-item, .item, .film-detail, .film-poster').each((i, el) => {
  if (i < 3) {
    console.log($(el).html()?.slice(0, 200));
  }
});

// Let's just print a bit of body
console.log($('body').html()?.slice(0, 500));
