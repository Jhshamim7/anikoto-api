import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
  const url = "https://megaplay.buzz/stream/s-2/94736/sub";
  const host = new URL(url).origin;
  
  try {
    const r = await axios.get(url, {
      headers: {
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://anikototv.to/"
      }
    });
    const $ = cheerio.load(r.data);
    const id = $("#megaplay-player").attr("data-id") || $("#megacloud-player").attr("data-id") || $("#rabbitstream-player").attr("data-id") || $("[data-id]").first().attr("data-id");
    console.log("ID:", id);

    if (id) {
        const sourceUrl = `${host}/stream/getSources?id=${encodeURIComponent(id)}`;
        console.log("Fetching:", sourceUrl);
        const sr = await axios.get(sourceUrl, {
            headers: {
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": `${host}/`
            }
        });
        console.log("Sources:", sr.data);
    }
  } catch (e: any) {
      console.log(e.message, e.response?.status, !!e.response?.data);
  }
}
test();
