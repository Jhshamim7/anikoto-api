/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useState} from 'react';

export default function App() {
  const [response, setResponse] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [animeId, setAnimeId] = useState('');
  const [epSlug, setEpSlug] = useState('');
  const [serverName, setServerName] = useState('hd-1');
  const [type, setType] = useState('sub');
  const [paramType, setParamType] = useState('movie');
  const [paramGenre, setParamGenre] = useState('action');

  const fetchEndpoint = async (url: string) => {
    setResponse('Loading...');
    setStreamUrl(null);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
      
      if (url.includes('/api/stream') && data.url) {
          if (!data.isM3U8) {
              setStreamUrl(data.url);
              setTimeout(() => {
                 setResponse((prev: any) => prev + "\n\n/* \nYou can render this as an iframe:\n<iframe src=\"" + data.url + "\" allowfullscreen></iframe>\n*/");
              }, 100);
          } else {
              setStreamUrl(null);
              setTimeout(() => {
                 setResponse((prev: any) => prev + "\n\n/* \nRaw .m3u8 stream extracted successfully! Use an HLS compatible video player (like hls.js or video.js) to play the video using this url:\n" + data.url + "\n*/");
              }, 100);
          }
      }
    } catch (error) {
      setResponse(JSON.stringify({error: 'Failed to fetch'}, null, 2));
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] p-8 font-sans">
      <header className="mb-8 border-b border-[#141414] pb-4">
        <h1 className="text-4xl font-bold tracking-tighter">ANIME-API.DEBUG</h1>
        <p className="font-serif italic opacity-70">Testing Interface v1.0</p>
      </header>

      <main className="grid md:grid-cols-[300px,1fr] gap-8">
        <aside className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest opacity-60">General API</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/latest-episodes`)}>Latest</button>
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/popular`)}>Popular</button>
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/completed`)}>Completed</button>
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/ongoing`)}>Ongoing</button>
            </div>
            <div className="flex gap-2">
              <input className="w-full p-2 border border-[#141414]" value={paramType} onChange={e => setParamType(e.target.value)} placeholder="e.g. movie" />
              <button className="whitespace-nowrap bg-[#141414] text-[#E4E3E0] px-4 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/type/${paramType}`)}>Type</button>
            </div>
            <div className="flex gap-2">
              <input className="w-full p-2 border border-[#141414]" value={paramGenre} onChange={e => setParamGenre(e.target.value)} placeholder="e.g. action" />
              <button className="whitespace-nowrap bg-[#141414] text-[#E4E3E0] px-4 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/genre/${paramGenre}`)}>Genre</button>
            </div>
          </div>
          <div className="space-y-2 border-t border-[#141414] pt-4">
            <label className="text-xs uppercase tracking-widest opacity-60">Search</label>
            <input className="w-full p-2 border border-[#141414]" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g., naruto" />
            <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/search?keyword=${keyword}`)}>Search</button>
          </div>
          <div className="space-y-2 border-t border-[#141414] pt-4">
            <label className="text-xs uppercase tracking-widest opacity-60">Anime Info & Episodes</label>
            <input className="w-full p-2 border border-[#141414] mb-2" value={animeId} onChange={e => setAnimeId(e.target.value)} placeholder="id (e.g. naruto-eybxz)" />
            <div className="grid grid-cols-2 gap-2">
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/info?id=${animeId}`)}>Get Info</button>
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800 text-sm" onClick={() => fetchEndpoint(`/api/episodes/${animeId}`)}>Get Episodes</button>
            </div>
          </div>
          <div className="space-y-2 border-t border-[#141414] pt-4">
            <label className="text-xs uppercase tracking-widest opacity-60">Streaming</label>
            <input className="w-full p-2 border border-[#141414] mb-2" value={epSlug} onChange={e => setEpSlug(e.target.value)} placeholder="ep slug (e.g. 1)" />
            
            <div className='flex gap-2 mb-2'>
                <select className="w-full p-2 border border-[#141414]" value={serverName} onChange={e => setServerName(e.target.value)}>
                    <option value="hd-1">hd-1</option>
                    <option value="hd-2">hd-2</option>
                </select>
                <select className="w-full p-2 border border-[#141414]" value={type} onChange={e => setType(e.target.value)}>
                    <option value="sub">sub</option>
                    <option value="dub">dub</option>
                </select>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800" onClick={() => fetchEndpoint(`/api/servers?id=${animeId}&ep=${epSlug}`)}>
                List Servers
              </button>
              <button className="w-full bg-[#141414] text-[#E4E3E0] p-2 hover:bg-gray-800" onClick={() => fetchEndpoint(`/api/stream?id=${animeId}&ep=${epSlug}&server=${serverName}&type=${type}`)}>
                Get Stream Link
              </button>
            </div>
          </div>
        </aside>

        <section className="flex flex-col gap-4">
          <pre className="p-6 bg-[#141414] text-[#E4E3E0] rounded border border-[#141414] font-mono text-sm max-h-[500px] overflow-auto whitespace-pre-wrap break-words">
            {response || '{ // waiting for API call ... }'}
          </pre>
          
          {streamUrl && (
              <div className="w-full aspect-video bg-black rounded overflow-hidden">
                  <iframe src={streamUrl} className="w-full h-full border-none" allowFullScreen></iframe>
              </div>
          )}
        </section>
      </main>
    </div>
  );
}
