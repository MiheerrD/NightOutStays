function parseCoordinates(text = '') {
  const value = String(text || '');
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+)[,%2C\s]+(-?\d{1,3}\.\d+)/i,
    /\"latitude\"\s*:\s*(-?\d{1,2}\.\d+).*?\"longitude\"\s*:\s*(-?\d{1,3}\.\d+)/s,
    /\"lat\"\s*:\s*(-?\d{1,2}\.\d+).*?\"lng\"\s*:\s*(-?\d{1,3}\.\d+)/s,
  ];
  for (const pattern of patterns) {
    const m = value.match(pattern);
    if (m) {
      const latitude = Number(m[1]);
      const longitude = Number(m[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
    }
  }
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const url = String(body?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return Response.json({ success:false, error:'Paste a valid Google Maps link.' }, { status:400 });
    const direct = parseCoordinates(decodeURIComponent(url));
    if (direct) return Response.json({ success:true, ...direct, resolvedUrl:url, source:'url' });
    const host = new URL(url).hostname.toLowerCase();
    if (!host.includes('google.') && !host.endsWith('goo.gl')) return Response.json({ success:false, error:'Only Google Maps links are supported.' }, { status:400 });
    const response = await fetch(url, { redirect:'follow', cache:'no-store', headers:{ 'User-Agent':'Mozilla/5.0 (compatible; NightOutStays/1.0)' } });
    const resolvedUrl = response.url || url;
    let coords = parseCoordinates(decodeURIComponent(resolvedUrl));
    let html = '';
    if (!coords) {
      try { html = await response.text(); } catch {}
      coords = parseCoordinates(html);
    }
    if (!coords) return Response.json({ success:false, error:'Could not read exact coordinates from this short link. Open Google Maps → Share → copy the full browser URL, or enter Latitude/Longitude manually.' }, { status:422 });
    return Response.json({ success:true, ...coords, resolvedUrl, source:'google_maps' });
  } catch (e) {
    return Response.json({ success:false, error:e?.message || 'Unable to resolve map location.' }, { status:500 });
  }
}
