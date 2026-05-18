import axios from "axios";

const ajaxClient = axios.create({
  baseURL: "https://anikototv.to",
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://anikototv.to",
  },
});

async function testServers() {
  try {
    const resp = await ajaxClient.get("/ajax/server/list", {
      params: { servers: "SlNVT25JaFlCMnZOeXZ2aG5takIxL2EybGl4TzJoNE1pN3JXdFNlODVocWtTckt1SFR0YUxrNzNhanQ2MEJoVG9UUEZNeWJOMm1uUThpYjNxejhhUEZWMitnNFFtTUNMYjBTc1FJZjZNNFZPNm5LMlVuTnpOU25ScUI1dHVGczM0UzluZ2xITG5qbExabnBDdGphY0VRPT0" },
      headers: { Referer: "https://anikototv.to/watch/7174/ep-1" },
    });
    console.log("Success!");
    console.log(resp.data);
  } catch (e) {
    console.error(e.response ? e.response.status + " " + e.response.data.result : e.message);
  }
}

testServers();
