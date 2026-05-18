import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
  const client = axios.create({ baseURL: "https://anikototv.to" });
  try {
     const resHome = await client.get("/home");
     const $h = cheerio.load(resHome.data);
     console.log("Home sections:");
     $h("section").each((_, el) => {
         console.log($h(el).find("h2.heading-name, .head .title, h2").text().trim(), "-> classes:", $h(el).attr("class"));
     });
     
     // let's grab the first from latest eps
     console.log("Latest Eps structure:");
     const latest = $h("section:contains('Latest Episode') .item, section:contains('Recently Updated') .item, .flw-item").first();
     console.log(latest.html());
     
  } catch(e) {
      console.log(e);
  }
}
test();
