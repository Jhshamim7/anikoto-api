import axios from "axios";
import fs from "fs";

async function fetchMainJs() {
  try {
    const { data } = await axios.get("https://anikototv.to/anikoto/js/main.js", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      }
    });
    fs.writeFileSync("main.js", data);
    console.log("Saved main.js");
  } catch (e) {
    console.error(e.response ? e.response.status : e.message);
  }
}

fetchMainJs();
