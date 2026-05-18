import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

async function fetchHtml() {
  try {
    const { data } = await axios.get("https://anikototv.to/filter?keyword=naruto", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      }
    });
    fs.writeFileSync("search.html", data);
    console.log("Saved search.html");
  } catch (e) {
    console.error(e);
  }
}

fetchHtml();
