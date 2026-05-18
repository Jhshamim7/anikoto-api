import axios from "axios";

async function fetchEps() {
  try {
    const { data } = await axios.get("https://anikototv.to/ajax/episode/list/7174", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      }
    });
    console.log(data);
  } catch (e) {
    console.error(e.response ? e.response.status : e.message);
  }
}

fetchEps();
