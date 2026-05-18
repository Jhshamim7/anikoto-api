import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

async function fetchInfo() {
  try {
    const { data } = await axios.get("https://anikototv.to/watch/road-of-naruto-ggjw8", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      }
    });
    fs.writeFileSync("info.html", data);
    console.log("Saved info.html");
  } catch (e) {
    console.error(e);
  }
}

fetchInfo();
