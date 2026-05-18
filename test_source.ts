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

async function testSource() {
  try {
    const resp = await ajaxClient.get("/ajax/server", {
      params: { get: "MTF1dkFtaW9BRTZPbzJJRElFZUZrOWdjeldjOERLaWNMMXFNbVB3WUJqOEZ4cFNpMDdQbnV1S3dNdklpRkhWbzRsVmgxSGx4YWx3LytPcnZXU0RCVHc9PQ" },
      headers: { Referer: "https://anikototv.to/watch/7174/ep-1" },
    });
    console.log("Success!");
    console.log(resp.data);
  } catch (e) {
    console.error(e.response ? e.response.status + " " + e.response.data.result : e.message);
  }
}

testSource();
