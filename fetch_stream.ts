import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

async function fetchStreamPage() {
  try {
    const { data } = await axios.get("https://anikototv.to/watch/7174/ep-1", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      }
    });
    fs.writeFileSync("stream.html", data);
    
    const $ = cheerio.load(data);
    console.log("Episodes div found:", $(".episodes").length);
    console.log("Servers div found:", $(".servers").length);
    console.log("List of episode links:");
    $(".episodes a").each((i, el) => {
      console.log($(el).attr("data-slug"), $(el).attr("data-id"));
    });
    console.log("Player div:", $("#player").html());
  } catch (e) {
    console.error(e.response ? e.response.status : e.message);
  }
}

fetchStreamPage();
