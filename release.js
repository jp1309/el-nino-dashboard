"use strict";

const ReleaseData = (() => {
  class EditionChanged extends Error {
    constructor(id) { super("La pagina pertenece a otra edicion"); this.edition = id; }
  }
  const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  async function request(url, fetcher) {
    const response = await fetcher(url, {cache: "no-store", signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response;
  }
  async function current(manifest, fetcher = fetch) {
    if (!manifest.id) return; // Direct local development; production always embeds a manifest.
    const response = await request(`version.json?check=${Date.now()}`, fetcher);
    const latest = await response.json();
    if (!/^[a-f0-9]{64}$/.test(latest.id || "")) throw new Error("Edicion publicada no verificable");
    if (latest.id !== manifest.id) throw new EditionChanged(latest.id);
  }
  async function file(entry, fetcher = fetch, cryptoApi = crypto) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = entry.path + (attempt ? `?retry=${Date.now()}` : "");
        const payload = await (await request(url, fetcher)).arrayBuffer();
        const digest = hex(await cryptoApi.subtle.digest("SHA-256", payload));
        if (digest !== entry.sha256) throw new Error("El archivo recibido no corresponde a esta edicion");
        return JSON.parse(new TextDecoder().decode(payload));
      } catch (error) { if (attempt === 1) throw error; }
    }
  }
  async function load(manifest, fetcher = fetch, cryptoApi = crypto) {
    await current(manifest, fetcher);
    if (manifest.id) {
      const [data, outlook] = await Promise.all([
        file(manifest.files["data/enso.json"], fetcher, cryptoApi),
        file(manifest.files["data/outlook.json"], fetcher, cryptoApi),
      ]);
      return {data, outlook}; // Only return when the whole pair has passed verification.
    }
    const data = await (await request("data/enso.json", fetcher)).json();
    let outlook = null;
    try { outlook = await (await request("data/outlook.json", fetcher)).json(); } catch (_error) { /* Optional in development. */ }
    return {data, outlook};
  }
  return {load, current, file, EditionChanged};
})();
if (typeof module !== "undefined") module.exports = ReleaseData;
