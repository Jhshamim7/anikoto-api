import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json());

const MEGAPLAY_KEYS = [
  { key: "i?LMTAx0Q6,:}50U", iv: "W0;27ToaUpl_P%'c" }
];

function decryptMegaPlay(encToken: string): { file?: string; [key: string]: any } | null {
  for (const { key, iv } of MEGAPLAY_KEYS) {
    try {
      const ceKC = new TextEncoder().encode(key);
      const keyBytes = new Uint8Array(32);
      keyBytes.set(ceKC.subarray(0, Math.min(32, ceKC.length)));

      const ceIV = new TextEncoder().encode(iv);
      const ivBytes = new Uint8Array(16);
      ivBytes.set(ceIV.subarray(0, Math.min(16, ceIV.length)));

      let b64 = encToken.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4;
      if (pad) b64 += "====".slice(pad);

      const cipherBuffer = Buffer.from(b64, "base64");
      const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(keyBytes), Buffer.from(ivBytes));
      let dec = decipher.update(cipherBuffer);
      dec = Buffer.concat([dec, decipher.final()]);
      const res = JSON.parse(dec.toString("utf8"));
      if (res && res.file) return res;
    } catch {
      // try next key
    }
  }
  return null;
}

const ajaxClient = axios.create({
  baseURL: "https://anikoto.cz",
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://anikoto.cz",
  },
});

const client = axios.create({
  baseURL: "https://anikoto.cz",
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

// Helper to extract the maximum page number from pagination links
function getMaxPage(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $(".pagination a.page-link").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/[?&]page=(\d+)/);
      if (match) {
        const pageNum = parseInt(match[1], 10);
        if (pageNum > maxPage) {
          maxPage = pageNum;
        }
      }
    }
  });
  return maxPage;
}

// Helper to fetch all pages for a given path
async function fetchAllPages(basePath: string, selector: string = ".item, .flw-item") {
  // 1. Fetch page 1
  const firstPageResp = await client.get(basePath);
  const results = extractAnimeList(firstPageResp.data, selector);
  
  // 2. Find max page
  const maxPage = getMaxPage(firstPageResp.data);
  if (maxPage <= 1) {
    return results;
  }
  
  // 3. Generate page urls for page 2 to maxPage
  const pageUrls: string[] = [];
  for (let p = 2; p <= maxPage; p++) {
    const separator = basePath.includes("?") ? "&" : "?";
    pageUrls.push(`${basePath}${separator}page=${p}`);
  }
  
  // 4. Fetch remaining pages with concurrency limit of 10
  const concurrencyLimit = 10;
  for (let i = 0; i < pageUrls.length; i += concurrencyLimit) {
    const chunk = pageUrls.slice(i, i + concurrencyLimit);
    const chunkPromises = chunk.map(url => 
      client.get(url)
        .then(res => extractAnimeList(res.data, selector))
        .catch(err => {
          console.error(`Error fetching page ${url}:`, err.message);
          return [] as any[];
        })
    );
    const chunkResults = await Promise.all(chunkPromises);
    for (const pageResults of chunkResults) {
      results.push(...pageResults);
    }
  }
  
  return results;
}

// Helper to fetch episode data-ids
async function getEpisodesData(animeId: string) {
  const { data: watchData } = await client.get(`/watch/${animeId}`);
  const $ = cheerio.load(watchData);
  const numericId = $("[data-id]").first().attr("data-id");
  
  if (!numericId) throw new Error("Could not find numeric ID");

  const resp = await ajaxClient.get(`/ajax/episode/list/${numericId}`, {
    headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
  });
  
  const html = resp.data.result;
  const $ep = cheerio.load(html);
  const episodes: any[] = [];
  
  $ep("a[data-ids], a.ep-item").each((_, el) => {
    const rawNum = $ep(el).attr("data-num") || $ep(el).text().trim() || "0";
    const epNum = parseInt(rawNum.replace(/\D+/g, "") || "0", 10);
    let epTitle = $ep(el).find(".ep-name, .d-title").text().trim() || $ep(el).attr("title");
    if (!epTitle) epTitle = `Episode ${epNum}`;
    
    episodes.push({
      num: epNum,
      title: epTitle,
      ids: $ep(el).attr("data-ids"),
      slug: $ep(el).attr("data-slug") || String(epNum),
      malId: parseInt($ep(el).attr("data-mal") || "0", 10) || null,
      isSub: $ep(el).attr("data-sub") === "1",
      isDub: $ep(el).attr("data-dub") === "1",
      isFiller: !!$ep(el).attr("class")?.includes("filler") || !!$ep(el).parent().attr("class")?.includes("filler"),
    });
  });
  
  // Fallback if the site structure changes
  if (episodes.length === 0) {
    $ep("a[data-ids]").each((_, el) => {
      const rawNum = $ep(el).attr("data-num") || $ep(el).text().trim() || "0";
      const epNum = parseInt(rawNum.replace(/\D+/g, "") || "0", 10);
      episodes.push({
        num: epNum,
        title: $ep(el).find(".ep-name, .d-title").text().trim() || $ep(el).parent().attr("title") || `Episode ${epNum}`,
        ids: $ep(el).attr("data-ids"),
        slug: $ep(el).attr("data-slug") || String(epNum),
        malId: parseInt($ep(el).attr("data-mal") || "0", 10) || null,
        isSub: $ep(el).attr("data-sub") === "1",
        isDub: $ep(el).attr("data-dub") === "1",
        isFiller: !!$ep(el).attr("class")?.includes("filler") || !!$ep(el).parent().attr("class")?.includes("filler"),
      });
    });
  }
  
  return { numericId, episodes };
}

// Helper function to map server names to standardized names
function mapServerName(name: string): string {
  const lowerName = name.toLowerCase().trim();
  return lowerName.replace(/\s+/g, "-");
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

app.get("/api/upcoming", async (req, res) => {
  try {
    const results = await fetchAllPages("/status/not-yet-aired");
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Upcoming error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape upcoming animes", details: e.message });
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
    const results = await fetchAllPages(`/genre/${category}`);
    res.json({ success: true, data: results });
  } catch (e: any) {
    console.error("Genre error:", e.message);
    res.status(500).json({ success: false, error: `Failed to scrape genre ${category}`, details: e.message });
  }
});

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w\-]+/g, "")       // Remove all non-word chars
    .replace(/\-\-+/g, "-")         // Replace multiple - with single -
    .replace(/^-+/, "")             // Trim - from start of text
    .replace(/-+$/, "");            // Trim - from end of text
}

app.get("/api/producer", async (req, res) => {
  const rawId = req.query.id as string;
  if (!rawId) return res.status(400).json({ success: false, error: "Producer ID/Name is required" });
  const producerSlug = slugify(rawId);
  try {
    const results = await fetchAllPages(`/producer/${producerSlug}`);
    res.json({ success: true, producer: rawId, slug: producerSlug, data: results });
  } catch (e: any) {
    console.error("Producer error:", e.message);
    res.status(500).json({ success: false, error: `Failed to scrape producer ${rawId}`, details: e.message });
  }
});

app.get("/api/studio", async (req, res) => {
  const rawId = req.query.id as string;
  if (!rawId) return res.status(400).json({ success: false, error: "Studio ID/Name is required" });
  const studioSlug = slugify(rawId);
  try {
    const results = await fetchAllPages(`/studio/${studioSlug}`);
    res.json({ success: true, studio: rawId, slug: studioSlug, data: results });
  } catch (e: any) {
    console.error("Studio error:", e.message);
    res.status(500).json({ success: false, error: `Failed to scrape studio ${rawId}`, details: e.message });
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
    let related: any[] = [];
    let seasons: any[] = [];

    // Parse static recommendations/related if they exist
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

    const showId = $('input[name="show_id"]').val();
    if (showId) {
      try {
        const seasonsResp = await ajaxClient.get(`/api/seasons/${showId}`, {
          headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
        });
        if (seasonsResp.data?.status === 200 && seasonsResp.data?.result) {
          const $seasons = cheerio.load(seasonsResp.data.result);
          $seasons(".season").each((_, el) => {
            const title = $seasons(el).find(".name").text().trim();
            const href = $seasons(el).find("a").attr("href") || "";
            const id = href.split("/watch/")[1] || "";
            const style = $seasons(el).find("a").attr("style") || "";
            const imgMatch = style.match(/url\(([^)]+)\)/);
            let image = "";
            if (imgMatch) {
              image = imgMatch[1].replace(/["\x27]/g, "");
            }
            const isActive = $seasons(el).hasClass("active");
            seasons.push({ title, id, image, isActive });
          });
        }
      } catch (err: any) {
        console.error("Failed to fetch seasons in info api:", err.message);
      }

      try {
        const watchOrderResp = await ajaxClient.get(`/api/watch-order/${showId}`, {
          headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
        });
        if (watchOrderResp.data?.status === 200 && watchOrderResp.data?.result) {
          const $related = cheerio.load(watchOrderResp.data.result);
          const orderRelated: any[] = [];
          $related(".item").each((_, el) => {
            const title = $related(el).find(".name").text().trim();
            const href = $related(el).find("a").attr("href") || "";
            const id = href.split("/watch/")[1] || "";
            const image = $related(el).find("img").attr("data-src") || $related(el).find("img").attr("src") || "";
            const relationId = $related(el).find(".relation").attr("id") || "";
            const relationType = relationId ? relationId.split("-").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "";
            orderRelated.push({ title, id, image, relationType });
          });
          if (orderRelated.length > 0) {
            related = orderRelated;
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch watch-order in info api:", err.message);
      }
    }

    const producer = info["producers"] ? info["producers"].join(", ") : (info["producer"] ? info["producer"].join(", ") : "unknown");
    const studio = info["studios"] ? info["studios"].join(", ") : (info["studio"] ? info["studio"].join(", ") : "unknown");

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
          seasons,
          recommendations: recommended,
          producer,
          studio,
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
    const cleanEp = epSlug ? epSlug.replace(/^ep-/, "") : "";
    const episode = episodes.find(
      (e) =>
        e.slug === epSlug ||
        e.slug === cleanEp ||
        String(e.num) === epSlug ||
        String(e.num) === cleanEp
    );
    
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const serverParams = episode.ids.includes("&eps=")
      ? { servers: episode.ids.split("&eps=")[0], eps: episode.ids.split("&eps=")[1] }
      : { servers: episode.ids };

    const resp = await ajaxClient.get(`/ajax/server/list`, {
      params: serverParams,
      headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
    });
    
    const html = resp.data.result || "";
    const $ = cheerio.load(html);
    const servers: any[] = [];
    
    $(".type li[data-link-id], li[data-link-id]").each((_, el) => {
      const name = $(el).text().trim();
      const mappedName = mapServerName(name);

      servers.push({
        type: $(el).closest(".type").attr("data-type") || "sub",
        serverName: mappedName,
        originalName: name,
        linkId: $(el).attr("data-link-id"),
        serverId: $(el).attr("data-sv-id") || $(el).attr("data-id")
      });
    });
    
    res.json({ success: true, data: servers });
  } catch (e: any) {
    console.error("Servers error:", e.message);
    res.status(500).json({ success: false, error: "Failed to scrape servers", details: e.message });
  }
});

app.get("/api/stream", async (req, res) => {
  const { id: animeId, ep: epSlug, server: serverName, linkId: queryLinkId, type = 'sub' } = req.query as { id: string, ep: string, server?: string, linkId?: string, type?: string };
  try {
    const { episodes } = await getEpisodesData(animeId);
    const cleanEp = epSlug ? epSlug.replace(/^ep-/, "") : "";
    const episode = episodes.find(
      (e) =>
        e.slug === epSlug ||
        e.slug === cleanEp ||
        String(e.num) === epSlug ||
        String(e.num) === cleanEp
    );
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const serverParams = episode.ids.includes("&eps=")
      ? { servers: episode.ids.split("&eps=")[0], eps: episode.ids.split("&eps=")[1] }
      : { servers: episode.ids };

    const serverResp = await ajaxClient.get(`/ajax/server/list`, {
      params: serverParams,
      headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
    });
    
    const html = serverResp.data.result || "";
    const $ = cheerio.load(html);
    
    let targetLinkId: string | undefined = queryLinkId;
    const requested = serverName ? serverName.toLowerCase().trim() : "";
    
    if (!targetLinkId && requested) {
      $(".type li[data-link-id], li[data-link-id]").each((_, el) => {
        const t = $(el).closest(".type").attr("data-type") || "sub";
        const link = $(el).attr("data-link-id");
        const svId = ($(el).attr("data-sv-id") || $(el).attr("data-id") || "").toLowerCase().trim();
        const origName = $(el).text().trim();
        const mapped = mapServerName(origName);

        if (t === type && link) {
          if (
            link === serverName ||
            svId === requested ||
            mapped === requested ||
            origName.toLowerCase() === requested
          ) {
            targetLinkId = link;
            return false;
          }
        }
      });
    }
    
    if (!targetLinkId) {
      targetLinkId = $(`.type[data-type='${type}'] li[data-link-id]`).first().attr("data-link-id");
    }
    
    if (!targetLinkId) {
      targetLinkId = $("li[data-link-id]").first().attr("data-link-id");
    }
    
    if (!targetLinkId) return res.status(404).json({ error: "No servers found for episode" });

    const sourceResp = await ajaxClient.get(`/ajax/server`, {
      params: { get: targetLinkId },
      headers: { Referer: `https://anikoto.cz/watch/${animeId}` }
    });
    
    const url = sourceResp.data.result?.url;
    let finalUrl = url;
    let isM3U8 = url?.includes(".m3u8");
    let intro = { start: 0, end: 0 };
    let outro = { start: 0, end: 0 };
    let subtitles: any[] = [];
    let streamReferer = url ? new URL(url).origin + "/" : "https://megaplay.buzz/";
    
    if (sourceResp.data.result?.intro) intro = sourceResp.data.result.intro;
    if (sourceResp.data.result?.outro) outro = sourceResp.data.result.outro;
    if (sourceResp.data.result?.tracks) subtitles = sourceResp.data.result.tracks;
    
    if (url && (url.includes('megaplay') || url.includes('vidwish') || url.includes('megacloud') || url.includes('rabbitstream') || url.includes('vidstream'))) {
       try {
             const embedParsed = new URL(url);
             const host = embedParsed.origin;
             streamReferer = `${host}/`;
             const sParam = embedParsed.searchParams.get('s') || '';

             const r = await axios.get(url, {
                headers: {
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Referer": "https://anikoto.cz/"
                },
                timeout: 10000
             });
             const $r = cheerio.load(r.data);
             const id = $r("#megaplay-player").attr("data-id") ||
                        $r("#megaplay-player").attr("data-realid") ||
                        $r("#megacloud-player").attr("data-id") ||
                        $r("#rabbitstream-player").attr("data-id") ||
                        $r("#vidcloud-player").attr("data-id") ||
                        $r("#vidstream-player").attr("data-id") ||
                        $r("[data-id]").first().attr("data-id") ||
                        (r.data.match(/data-id="([^"]+)"/) ? r.data.match(/data-id="([^"]+)"/)[1] : null);
             
             if (id) {
                 const querySuffix = sParam ? `&s=${encodeURIComponent(sParam)}` : '';
                 const sourceEndpoints = [
                     `${host}/stream/getSources?id=${encodeURIComponent(id)}${querySuffix}`,
                     `${host}/stream/getSourcesNew?id=${encodeURIComponent(id)}${querySuffix}`,
                     `${host}/stream/getSources?id=${encodeURIComponent(id)}`,
                     `${host}/embed-2/ajax/e-1/getSources?id=${encodeURIComponent(id)}`
                 ];

                 let sr: any = null;
                 for (const sUrl of sourceEndpoints) {
                     try {
                         sr = await axios.get(sUrl, {
                             headers: {
                                 "Accept": "application/json, text/javascript, */*; q=0.01",
                                 "X-Requested-With": "XMLHttpRequest",
                                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                 "Referer": url
                             },
                             timeout: 8000
                         });
                         if (sr?.data && (sr.data.enc || sr.data.sources)) break;
                     } catch {
                         // try next
                     }
                 }

                 if (sr?.data) {
                     if (sr.data.intro) intro = sr.data.intro;
                     if (sr.data.outro) outro = sr.data.outro;
                     if (sr.data.tracks) {
                       const captions = sr.data.tracks.filter((t: any) => t.kind === "captions");
                       subtitles = captions.length > 0 ? captions : sr.data.tracks;
                     }

                     if (sr.data.enc) {
                         const decrypted = decryptMegaPlay(sr.data.enc);
                         if (decrypted && decrypted.file) {
                             finalUrl = decrypted.file;
                             isM3U8 = true;
                         }
                     } else if (sr.data.sources) {
                         const file = sr.data.sources.file || (Array.isArray(sr.data.sources) && sr.data.sources[0]?.file);
                         if (file) {
                             finalUrl = file;
                             isM3U8 = true;
                         }
                     }

                     // Fix blocked cdn.imgnex.top domain to active working ncdn.imgnex.top mirror
                     if (finalUrl && finalUrl.includes("cdn.imgnex.top")) {
                         finalUrl = finalUrl.replace("https://cdn.imgnex.top", "https://ncdn.imgnex.top");
                     }
                 }
             }
         } catch(e: any) {
             console.log("MegaPlay extraction failed, falling back to Iframe URL:", e.message);
         }
    }

    res.json({
      success: true,
      data: {
             m3u8: isM3U8 ? finalUrl : null,
             referer: streamReferer,
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
