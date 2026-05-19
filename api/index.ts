import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());
app.use(express.json());

const ajaxClient = axios.create({
  baseURL: "https://anikototv.to",
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://anikototv.to",
  },
});

const client = axios.create({
  baseURL: "https://anikototv.to",
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

// Helper to extract anime list from HTML
function extractAnimeList(html: string, selector: string = ".item, .flw-item") {
  const $ = cheerio.load(html);
  const results: any[] = [];
  
  $(selector).each((_, el) => {
      const url = $(el).find(".name").attr("href") || $(el).find("a").attr("href") || "";
      const id = url.replace(/.*?\/watch\//, "").replace(/\/ep-.*$/, "").replace(/\/$/, "");
      
      if (!id) return;

      let sub = $(el).find(".ep-status.sub").text().trim() || null;
      let dub = $(el).find(".ep-status.dub").text().trim() || null;
      let episodes = $(el).find(".ep-status.total").text().trim() || null;
      
      if(sub) sub = sub.replace(/\D+/g, '');
      if(dub) dub = dub.replace(/\D+/g, '');
      if(episodes) episodes = episodes.replace(/\D+/g, '');
      
      results.push({
        id,
        title: $(el).find(".name").text().trim() || $(el).find(".film-name").text().trim() || $(el).find(".dynamic-name").text().trim() || $(el).find("img").attr("alt") || "",
        image: $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || "",
        type: $(el).find(".meta .right").text().trim() || $(el).find(".meta .dot").first().text().trim() || null,
        sub,
        dub,
        episodes
      });
  });
  return results;
}

// Helper to fetch episode data-ids
async function getEpisodesData(animeId: string) {
  const { data: watchData } = await client.get(`/watch/${animeId}`);
  const $ = cheerio.load(watchData);
  const numericId = $("[data-id]").first().attr("data-id");
  
  if (!numericId) throw new Error("Could not find numeric ID");

  const resp = await ajaxClient.get(`/ajax/episode/list/${numericId}`, {
    headers: { Referer: `https://anikototv.to/watch/${animeId}` }
  });
  
  const html = resp.data.result;
  const $ep = cheerio.load(html);
  const episodes: any[] = [];
  
  $ep("a.ep-item").each((_, el) => {
    const epNum = parseInt($ep(el).attr("data-num") || "0", 10);
    let epTitle = $ep(el).find(".ep-name, .d-title").text().trim() || $ep(el).attr("title");
    if(!epTitle) epTitle = `Episode ${epNum}`;
    
    episodes.push({
      num: epNum,
      title: epTitle,
      ids: $ep(el).attr("data-ids"),
      slug: $ep(el).attr("data-slug"),
      malId: parseInt($ep(el).attr("data-mal") || "0", 10) || null,
      isSub: $ep(el).attr("data-sub") === "1",
      isDub: $ep(el).attr("data-dub") === "1",
      isFiller: !!$ep(el).attr("class")?.includes("filler") || !!$ep(el).parent().attr("class")?.includes("filler"),
    });
  });
  
  // Fallback if the site structure changes
  if (episodes.length === 0) {
    $ep("a[data-ids][data-num]").each((_, el) => {
      episodes.push({
        num: parseInt($ep(el).attr("data-num") || "0", 10),
        title: $ep(el).find(".ep-name, .d-title").text().trim() || $ep(el).parent().attr("title") || `Episode ${$ep(el).attr("data-num")}`,
        ids: $ep(el).attr("data-ids"),
        slug: $ep(el).attr("data-slug"),
        malId: parseInt($ep(el).attr("data-mal") || "0", 10) || null,
        isSub: $ep(el).attr("data-sub") === "1",
        isDub: $ep(el).attr("data-dub") === "1",
        isFiller: !!$ep(el).attr("class")?.includes("filler") || !!$ep(el).parent().attr("class")?.includes("filler"),
      });
    });
  }
  
  return { numericId, episodes };
}

// API routes
app.get("/api/search", async (req, res) => {
  const keyword = req.query.keyword as string;
  if (!keyword) return res.status(400).json({ error: "Keyword required" });
  try {
    const resp = await client.get("/filter", { params: { keyword } });
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Search error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape search results", details: e.message });
  }
});

app.get("/api/latest-episodes", async (req, res) => {
  try {
    const resp = await client.get("/home");
    const results = extractAnimeList(resp.data, "section:contains('Latest Episode') .item, section:contains('Recently Updated') .item, .flw-item");
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Latest eps error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape latest episodes", details: e.message });
  }
});

app.get("/api/popular", async (req, res) => {
  try {
    const resp = await client.get("/most-viewed");
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Popular error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape popular animes", details: e.message });
  }
});

app.get("/api/completed", async (req, res) => {
  try {
    const resp = await client.get("/status/finished-airing");
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Completed error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape completed animes", details: e.message });
  }
});

app.get("/api/ongoing", async (req, res) => {
  try {
    const resp = await client.get("/status/currently-airing");
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Ongoing error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape ongoing animes", details: e.message });
  }
});

app.get("/api/type/:type", async (req, res) => {
  const { type } = req.params;
  try {
    const resp = await client.get(`/type/${type}`);
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Type error:", e.message);
    res.status(500).json({ success: false, error: `Failed to scrape type ${type}`, details: e.message });
  }
});

app.get("/api/genre/:category", async (req, res) => {
  const { category } = req.params;
  try {
    const resp = await client.get(`/genre/${category}`);
    const results = extractAnimeList(resp.data);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Genre error:", e.message);
    res.status(500).json({ success: false, error: `Failed to scrape genre ${category}`, details: e.message });
  }
});

app.get("/api/info", async (req, res) => {
  const animeId = req.query.id as string;
  if (!animeId) return res.status(400).json({ success: false, error: "Anime ID is required" });
  try {
    const { data } = await client.get(`/watch/${animeId}`);
    const $ = cheerio.load(data);
    const title = $('h1.title.d-title').text().trim() || $('h1').text().trim();
    const poster = $('.poster img').attr('src') || "";
    const description = $('.synopsis').text().trim();
    
    const info: Record<string, string[]> = {};
    $(".bmeta .meta div").each((_, el) => {
      let textNode = $(el).contents().filter((_, node) => node.type === "text").text().trim();
      const key = textNode.replace(":", "").toLowerCase().trim();
      if (key) {
        const vals: string[] = [];
        
        const aTags = $(el).find('a');
        if (aTags.length > 0) {
          aTags.each((_, a) => { vals.push($(a).text().trim()); });
        } else {
          vals.push($(el).find('span').text().trim());
        }
        if (vals.length) info[key] = vals;
      }
    });

    let malId: number | null = null;
    let anilistId: number | null = null;
    let totalSub = 0;
    let totalDub = 0;
    
    try {
      const { episodes } = await getEpisodesData(animeId);
      if (episodes.length > 0) {
          const firstEp = episodes[0];
          if (firstEp.malId) malId = firstEp.malId;
      }
      totalSub = episodes.filter(e => e.isSub).length;
      totalDub = episodes.filter(e => e.isDub).length;
    } catch (epErr) {
      console.error("Could not fetch episodes for info:", epErr);
    }
    
    if (malId) {
        try {
           const query = `query($idMal:Int){Media(idMal:$idMal,type:ANIME){id}}`;
           const gqResp = await axios.post("https://graphql.anilist.co", { query, variables: { idMal: malId } });
           anilistId = gqResp.data?.data?.Media?.id || null;
        } catch(e) {
           console.error("Anilist mapping failed", e);
        }
    }

    const recommended: any[] = [];
    const related: any[] = [];
    
    const seasons = $("#ani-seasons a").map((_, el) => ({
      title: $(el).text().trim(),
      id: $(el).attr("href")?.split("/watch/")[1] || ""
    })).get().filter(x => x.title && x.id);

    $(".w-side-section").each((_, el) => {
      const sectionTitle = $(el).find(".title").text().trim().toLowerCase();
      const items = $(el).find(".item").map((__, iel) => ({
          title: $(iel).find(".name, .title, .dynamic-name").text().trim() || $(iel).attr("title"),
          id: $(iel).attr("href")?.split("/watch/")[1] || "",
          image: $(iel).find("img").attr("data-src") || $(iel).find("img").attr("src"),
      })).get().filter((x: any) => x.title && x.id);
      
      if (sectionTitle.includes("recommend")) {
          items.forEach((item: any) => recommended.push(item));
      } else if (sectionTitle.includes("relat") || sectionTitle.includes("season") || sectionTitle.includes("more")) {
          items.forEach((item: any) => related.push(item));
      }
    });
    
    if (related.length === 0 && seasons.length > 0) {
        seasons.forEach((s: any) => related.push(s));
    }

    res.json({
      success: true,
      data: {
          id: animeId, 
          title, 
          poster, 
          description,
          malId,
          anilistId,
          totalSub,
          totalDub,
          related,
          recommendations: recommended,
          ...info
      }
    });
  } catch (e: any) {
    console.error("Info error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape info", details: e.message });
  }
});

app.get("/api/episodes/:animeId", async (req, res) => {
  const { animeId } = req.params;
  try {
    const { episodes } = await getEpisodesData(animeId);
    const formattedEpisodes = episodes.map(e => ({
        num: e.num,
        title: e.title,
        slug: e.slug,
        isSub: e.isSub,
        isDub: e.isDub,
        isFiller: e.isFiller
    }));
    res.json({ success: true, data: formattedEpisodes });
  } catch (e: any) {
    console.error("Episodes error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape episodes", details: e.message });
  }
});

app.get("/api/servers", async (req, res) => {
  const { id: animeId, ep: epSlug } = req.query as { id: string, ep: string };
  try {
    const { episodes } = await getEpisodesData(animeId);
    const episode = episodes.find(e => e.slug === epSlug);
    
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const [animeNumId, epsNum] = episode.ids.split("&eps=");
    const resp = await ajaxClient.get(`/ajax/server/list`, {
      params: { servers: animeNumId, eps: epsNum },
      headers: { Referer: `https://anikototv.to/watch/${animeId}` }
    });
    
    const html = resp.data.result || "";
    const $ = cheerio.load(html);
    const servers: any[] = [];
    
    $(".type li[data-link-id]").each((_, el) => {
      let name = $(el).text().trim().toLowerCase();
      let mappedName = name;
      if (name.includes("vidcloud") || name.includes("megacloud") || name.includes("rabbitstream")) mappedName = "hd-1";
      if (name.includes("vidstream") || name.includes("megaplay")) mappedName = "hd-2";

      servers.push({
        type: $(el).closest(".type").attr("data-type"),
        serverName: mappedName,
        originalName: name,
        linkId: $(el).attr("data-link-id"),
        serverId: $(el).attr("data-sv-id")
      });
    });
    
    res.json({ success: true, data: servers });
  } catch (e: any) {
    console.error("Servers error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape servers", details: e.message });
  }
});

app.get("/api/stream", async (req, res) => {
  const { id: animeId, ep: epSlug, server: serverName, type = 'sub' } = req.query as { id: string, ep: string, server: string, type: string };
  try {
    const { episodes } = await getEpisodesData(animeId);
    const episode = episodes.find(e => e.slug === epSlug);
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const [animeNumId, epsNum] = episode.ids.split("&eps=");
    const serverResp = await ajaxClient.get(`/ajax/server/list`, {
      params: { servers: animeNumId, eps: epsNum },
      headers: { Referer: `https://anikototv.to/watch/${animeId}` }
    });
    
    const html = serverResp.data.result || "";
    const $ = cheerio.load(html);
    
    let targetLinkId: string | undefined;
    
    $(".type li[data-link-id]").each((_, el) => {
      const t = $(el).closest(".type").attr("data-type");
      let name = $(el).text().trim().toLowerCase();
      let mappedName = name;
      if (name.includes("vidcloud") || name.includes("megacloud") || name.includes("rabbitstream")) mappedName = "hd-1";
      if (name.includes("vidstream") || name.includes("megaplay")) mappedName = "hd-2";

      if (t === type && mappedName === serverName) {
        targetLinkId = $(el).attr("data-link-id");
      }
    });
    
    if (!targetLinkId) {
       targetLinkId = $(`.type[data-type='${type}'] li[data-link-id]`).first().attr("data-link-id");
    }
    
    if (!targetLinkId) {
       targetLinkId = $("li[data-link-id]").first().attr("data-link-id");
    }
    
    if (!targetLinkId) return res.status(404).json({ error: "No servers found for episode" });

    const sourceResp = await ajaxClient.get(`/ajax/server`, {
      params: { get: targetLinkId },
      headers: { Referer: `https://anikototv.to/watch/${animeId}` }
    });
    
    const url = sourceResp.data.result?.url;
    let finalUrl = url;
    let isM3U8 = url?.includes(".m3u8");
    let intro = { start: 0, end: 0 };
    let outro = { start: 0, end: 0 };
    let subtitles: any[] = [];
    
    if (sourceResp.data.result?.intro) intro = sourceResp.data.result.intro;
    if (sourceResp.data.result?.outro) outro = sourceResp.data.result.outro;
    if (sourceResp.data.result?.tracks) subtitles = sourceResp.data.result.tracks;
    
    if (url && (url.includes('megaplay') || url.includes('vidwish') || url.includes('megacloud') || url.includes('rabbitstream') || url.includes('vidstream'))) {
       try {
           const host = new URL(url).origin;
           const r = await axios.get(url, {
              headers: {
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://anikototv.to/"
              },
              timeout: 10000
           });
           const $r = cheerio.load(r.data);
           const id = $r("#megaplay-player").attr("data-id") || $r("#megacloud-player").attr("data-id") || $r("#rabbitstream-player").attr("data-id") || $r("[data-id]").first().attr("data-id");
           
           if (id) {
               const sourceUrl = `${host}/stream/getSources?id=${encodeURIComponent(id)}`;
               const sr = await axios.get(sourceUrl, {
                   headers: {
                       "Accept": "*/*",
                       "X-Requested-With": "XMLHttpRequest",
                       "Referer": `${host}/`
                   },
                   timeout: 10000
               });
               if (sr.data && sr.data.sources && sr.data.sources.file) {
                   finalUrl = sr.data.sources.file;
                   isM3U8 = true;
                   if (sr.data.intro) intro = sr.data.intro;
                   if (sr.data.outro) outro = sr.data.outro;
                   if (sr.data.tracks) subtitles = sr.data.tracks;
               } else {
                   isM3U8 = false;
               }
           } else {
               isM3U8 = false;
           }
       } catch(e: any) {
           console.log("MegaPlay extraction failed, falling back to Iframe URL:", e.message);
           isM3U8 = false;
       }
    }

    res.json({
      success: true,
      data: {
           m3u8: isM3U8 ? finalUrl : null,
           referer: url ? new URL(url).origin + "/" : null,
           intro,
           outro,
           subtitles
      }
    });
  } catch (e: any) {
    console.error("Stream error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape stream", details: e.message });
  }
});

export default app;
