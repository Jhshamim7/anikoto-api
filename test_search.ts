import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
  const r = await axios.get('https://anikototv.to/filter?keyword=naruto');
  const $ = cheerio.load(r.data);
  const el = $('.item').first();
  console.log(el.html());
}
test();
