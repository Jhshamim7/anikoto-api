import axios from "axios";

async function testSourceUrl() {
  try {
    const resp = await axios.get("https://megaplay.buzz/ajax/embed-2/getSources?id=18980", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://megaplay.buzz/stream/s-2/94736/sub"
      }
    });
    console.log(resp.data);
  } catch(e) {
    console.error(e.message);
  }
}
testSourceUrl();
