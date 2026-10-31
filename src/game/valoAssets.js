/**
 * Authentic Valorant art, loaded at runtime from the public valorant-api CDN
 * (https://media.valorant-api.com). Everything here is optional decoration:
 * if the network is blocked the game keeps working with its procedural art,
 * every helper resolves to `null` and callers fall back.
 *
 * The UUIDs below come from the public valorant-api dataset. This is a fan
 * project, not affiliated with Riot Games.
 */

export const VALO_CDN = 'https://media.valorant-api.com';

/* ------------------------------------------------------------------ */
/* agents                                                              */
/* ------------------------------------------------------------------ */
export const AGENT_ART = {
  phoenix: { uuid: 'eb93336a-449b-9c1b-0a54-a891f7921d69', name: 'PHOENIX', role: 'DUELİST', color: '#ff8a3d' },
  omen: { uuid: '8e253930-4c05-31dd-1b6c-968525494517', name: 'OMEN', role: 'KONTROLCÜ', color: '#7d6bff' },
  sova: { uuid: '320b2a48-4d9b-a075-30f1-1f93a9b638fa', name: 'SOVA', role: 'BAŞLATICI', color: '#5fc9ff' },
  sage: { uuid: '569fdd95-4d10-43ab-ca70-79becc718b46', name: 'SAGE', role: 'NÖBETÇİ', color: '#4ff0c0' },
  // extra faces used by the bot roster
  jett: { uuid: 'add6443a-41bd-e414-f6ad-e58d267f4e95', name: 'JETT', role: 'DUELİST', color: '#7fd8ff' },
  reyna: { uuid: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc', name: 'REYNA', role: 'DUELİST', color: '#b46bff' },
  viper: { uuid: '707eab51-4836-f488-046a-cda6bf494859', name: 'VIPER', role: 'KONTROLCÜ', color: '#63d84f' },
  cypher: { uuid: '117ed9e3-49f3-6512-3ccf-0cada7e3823b', name: 'CYPHER', role: 'NÖBETÇİ', color: '#d8b45a' },
  breach: { uuid: '5f8d3a7f-467b-97f3-062c-13acf203c006', name: 'BREACH', role: 'BAŞLATICI', color: '#ff9c3d' },
  killjoy: { uuid: '1e58de9c-4950-5125-93e9-a0aee9f98746', name: 'KILLJOY', role: 'NÖBETÇİ', color: '#ffd85a' },
};

export const agentArtUrl = (key, kind = 'fullportrait') => {
  const a = AGENT_ART[key];
  if (!a) return null;
  const file = kind === 'icon' ? 'displayicon.png'
    : kind === 'killfeed' ? 'killfeedportrait.png'
      : kind === 'bust' ? 'bustportrait.png'
        : 'fullportrait.png';
  return `${VALO_CDN}/agents/${a.uuid}/${file}`;
};

/* ------------------------------------------------------------------ */
/* maps                                                                */
/* ------------------------------------------------------------------ */
export const MAP_ART = [
  { key: 'ascent', name: 'ASCENT', uuid: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319', desc: 'Venedik kanalları, açık orta ve iki büyük spike alanı.' },
  { key: 'bind', name: 'BIND', uuid: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba', desc: 'Fas esintili sokaklar, ışınlanma kapıları, dar koridorlar.' },
  { key: 'haven', name: 'HAVEN', uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047', desc: 'Üç spike alanı olan tek harita; savunma her yere yetişemez.' },
  { key: 'split', name: 'SPLIT', uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2', desc: 'Tokyo silüeti, yüksek kule ve ışınlanma halatları.' },
  { key: 'icebox', name: 'ICEBOX', uuid: 'e2ad5c54-4114-a870-9641-8ea21279579a', desc: 'Arktik liman, halatlar ve dikey oynanış.' },
  { key: 'lotus', name: 'LOTUS', uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9', desc: 'Hint tapınağı; üç alan, dönen kapılar, sessiz geçişler.' },
  { key: 'sunset', name: 'SUNSET', uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498', desc: 'Los Angeles sokakları, dar mid ve yakın dövüş cepleri.' },
  { key: 'pearl', name: 'PEARL', uuid: 'fd267378-4d1d-484f-ff52-77821ed10dc2', desc: 'Sualtı şehri, geniş mid ve uzun görüş hatları.' },
  { key: 'breeze', name: 'BREEZE', uuid: '2fb9a4fd-47b8-4e7d-a969-74b4046ebd53', desc: 'Karayip kıyısı; uzun menzilli tüfeklerin cenneti.' },
  { key: 'fracture', name: 'FRACTURE', uuid: 'b529448b-4d60-346e-e89e-00a4c527a405', desc: 'İki taraftan saldırılan çatlak harita; spawn baskısı.' },
  { key: 'abyss', name: 'ABYSS', uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f', desc: 'Uçurumun kenarında; düşmek de bir ölüm.' },
];

export const mapArtUrl = (uuid, kind = 'splash') => {
  if (!uuid) return null;
  const file = kind === 'icon' ? 'displayicon.png'
    : kind === 'list' ? 'listviewicon.png'
      : 'splash.png';
  return `${VALO_CDN}/maps/${uuid}/${file}`;
};

/* ------------------------------------------------------------------ */
/* weapon skins                                                        */
/* ------------------------------------------------------------------ */
/** Curated authentic skins per weapon. uuids point at the public
 *  valorant-api weapon-skin renders (media.valorant-api.com). */
export const WEAPON_SKINS = {
  classic: [
    { name: "Prime", uuid: 'd653f4a7-4e92-2559-0a97-2c9d46d009b3' },
    { name: "Glitchpop", uuid: '8b2598eb-4db9-6338-4a25-c780402c780e' },
    { name: "Spectrum", uuid: '46f32f75-4fc8-7121-8a77-db8db43afc67' },
    { name: "RGX 11z Pro", uuid: '111680fd-4562-f658-af1c-ed8f9cfe9f9c' },
    { name: "Forsaken", uuid: 'c612138e-4007-6d0c-64ad-3690c65ee4a7' },
    { name: "VALORANT GO! Vol. 2", uuid: 'b06e13ff-4f19-c750-ffcd-8084dfc3bbf5' },
    { name: "Pistolinha", uuid: '34919680-4f00-554b-0c2b-95acca7d0d36' },
  ],
  ghost: [
    { name: "Magepunk", uuid: '33824a13-453b-0636-4ec4-e19708aa934e' },
    { name: "Sovereign", uuid: 'a9890917-41ea-eb55-47e7-ee990a87fa4e' },
    { name: "Gaia's Vengeance", uuid: 'daed0e44-4ab6-22b4-a5a5-57a4957a056b' },
    { name: "Ruination", uuid: '8a513c24-4c4d-ac15-6066-a1b2ff577041' },
    { name: "VALORANT GO! Vol. 1", uuid: '3714831b-4b90-bb6b-4185-7fb05ba9b9a2' },
    { name: "Endeavour", uuid: 'cd281dcd-4276-1def-11d9-74a4a72db204' },
    { name: "Piedra del Sol", uuid: '9db45d13-4cc3-4b6c-4801-459b79f8cda5' },
  ],
  sheriff: [
    { name: "Reaver", uuid: 'a40a6ce2-462c-c864-5d30-7b9408b98d3d' },
    { name: "Magepunk", uuid: '6460edbf-458d-bf61-7519-519305ba5da2' },
    { name: "Ion", uuid: '83778c03-45a3-67a2-3c89-6b8598327d58' },
    { name: "Sentinels of Light", uuid: '2ba3ded8-47d5-58e3-1307-39800214636d' },
    { name: "Wayfarer", uuid: '34f735c0-4fcd-b4fd-fb34-fbab97b42a41' },
    { name: "Immortalized", uuid: '304e1a7a-411d-2d27-dad6-c09702b5ea2f' },
    { name: "Aristocrat", uuid: '840f12d8-467b-1a5e-f79c-b893b72b2fbc' },
  ],
  spectre: [
    { name: "Prime", uuid: '20807bd8-4259-35e5-e54e-c1b214f58cc8' },
    { name: "Magepunk", uuid: 'a3f8e1b3-4654-f3ea-15ba-9eb9fd6a0b0d' },
    { name: "Reaver", uuid: '1cb1ab52-4c7d-0775-77f4-eaac99968261' },
    { name: "Radiant Crisis 001", uuid: '780a93e6-46aa-50c7-5e73-b885c5f6a141' },
    { name: "Ruination", uuid: 'f9c2e823-4eeb-d872-8a4c-d5a0bf8a3b6c' },
    { name: "Forsaken", uuid: 'a786ea8f-42f2-ae5f-376f-2bb66df1a62f' },
    { name: "Task Force 809", uuid: 'e78fb82c-4800-e102-b7a6-33946fa2f199' },
  ],
  judge: [
    { name: "Elderflame", uuid: '0221b120-444b-6d1b-fc50-e4a98e470eb2' },
    { name: "Glitchpop", uuid: '28a659a4-439e-fcd0-6236-d39979ee5c51' },
    { name: "Piedra del Sol", uuid: 'd7717613-4ef6-b314-6a95-9e8a1ee603bf' },
    { name: "Undercity", uuid: 'e413125e-40c6-cccd-de35-f28e34c57442' },
    { name: "ChronoVoid", uuid: '4d2ec3f4-446e-a501-74d8-5ab750f50984' },
    { name: "Rush", uuid: 'f6db3976-4c70-c3bf-01f8-dca6d335319a' },
    { name: "Team Ace", uuid: 'fdf7fef7-43db-9409-be4c-44bc0b5084f6' },
  ],
  bulldog: [
    { name: "Glitchpop", uuid: '285c6731-4451-b930-7a3d-c5a736d00f5e' },
    { name: "Aristocrat", uuid: 'c610dbc8-4a90-3c86-7f9e-bfa910f75bb9' },
    { name: "Endeavour", uuid: '3f8be578-4e47-8afd-1e6c-cb9bb326e8b5' },
    { name: "Spectrum", uuid: 'fbe04552-445f-f202-923e-6fbd61b7e2aa' },
    { name: "Striker", uuid: '9c056543-44af-0d36-d0f7-1196d93d264e' },
    { name: "Rune Stone", uuid: '8594c025-4c96-e258-13da-53a2f747bca2' },
    { name: "Undercity", uuid: '4be8d0e7-48e0-eaa3-1db4-85a14094f369' },
  ],
  vandal: [
    { name: "Prime", uuid: 'b9ee2457-481c-6776-3f5b-0ca8e8f90c89' },
    { name: "Reaver", uuid: '30388628-42f0-606c-82c0-73ad43de997f' },
    { name: "Elderflame", uuid: '18609205-4edb-5966-cff8-0fba0230ba1e' },
    { name: "Glitchpop", uuid: '74789f33-4632-8052-96d7-258538721a32' },
    { name: "Champions 2021", uuid: '9bf19b77-4b33-7203-9f2c-16932970622f' },
    { name: "Gaia's Vengeance", uuid: '000ad7b1-44b0-9345-ea47-9cbd7dcdbb38' },
    { name: "Prelude to Chaos", uuid: '522a264e-4ca7-adb0-6cf1-28b2ef938727' },
    { name: "Sentinels of Light", uuid: 'e8df3725-40de-b8ec-77bd-62a989685a85' },
    { name: "Forsaken", uuid: '437307c6-424c-6a48-9738-949b91166353' },
    { name: "RGX 11z Pro", uuid: 'e5490f71-455b-74ad-f762-f5a876d4dff9' },
  ],
  phantom: [
    { name: "Oni", uuid: '36791b03-452d-8dad-0091-898cc28d2196' },
    { name: "Reaver", uuid: '044b28ba-4c3b-d315-140d-d9a249da5567' },
    { name: "Spectrum", uuid: '980fa063-436e-e51f-c38d-70a5b93a0f1c' },
    { name: "Glitchpop", uuid: '25a7f0f2-4bce-7e45-b4b0-ca9264f5dfcc' },
    { name: "Champions 2022", uuid: '8c72ae0b-4357-1a75-ad62-fbaec7b64f92' },
    { name: "Protocol 781-A", uuid: '9877d50b-43b1-837a-802a-bf8a3b98e2dd' },
    { name: "Task Force 809", uuid: '3d71065e-4f0b-19a8-26d5-129cddeb013b' },
  ],
  operator: [
    { name: "Elderflame", uuid: 'd722313d-43cb-b38d-7841-75880a3ed2cb' },
    { name: "Reaver", uuid: 'aecab890-43b7-d719-06bc-9295e3d116dc' },
    { name: "Glitchpop", uuid: 'a491b943-43e3-4e98-64a6-fc87fca43605' },
    { name: "Origin", uuid: '17831113-4ff0-a6c9-0b20-6f9c077d74a2' },
    { name: "Spline", uuid: 'b2164926-4b85-852a-4bd7-d9bc27a642da' },
    { name: "Forsaken", uuid: 'c692e38e-4f38-0141-d0c9-aa99fab9362a' },
    { name: "Magepunk", uuid: '7e831918-4580-5e2a-089a-84ad58fe1aae' },
  ],
  odin: [
    { name: "Glitchpop", uuid: '97af88e4-4176-9fa3-4a26-57919443dab7' },
    { name: "Xenohunter", uuid: '94c085e6-48e1-c879-2552-88bf7850c5a8' },
    { name: "Rune Stone", uuid: 'abef8114-4495-6da7-2ade-02bd0f014fd3' },
    { name: "Nitro", uuid: '2715f184-46cc-bec1-dd7c-e7b4d1aeb625' },
    { name: ".EXE", uuid: 'cda41b87-4d3a-c17c-5f6d-8990cc9c5efb' },
    { name: "Prime//2.0", uuid: '157bcebe-484d-82e2-2a60-c8b4b11197ea' },
    { name: "Prism III", uuid: '72e724e9-4ba4-2d12-ce1a-8db1a528b9d3' },
  ],
};

export const skinIconUrl = (uuid) => (uuid ? `${VALO_CDN}/weaponskins/${uuid}/displayicon.png` : null);

/* ------------------------------------------------------------------ */
/* image helpers                                                       */
/* ------------------------------------------------------------------ */
const imageCache = new Map();

/** Load an <img>, cached. Resolves to null when offline / blocked / broken. */
export function loadImage(url, { timeout = 9000, crossOrigin = 'anonymous' } = {}) {
  if (!url) return Promise.resolve(null);
  const key = `${crossOrigin || 'plain'}|${url}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const promise = new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    const timer = setTimeout(() => finish(null), timeout);
    img.onload = () => { clearTimeout(timer); finish(img.naturalWidth > 1 ? img : null); };
    img.onerror = () => { clearTimeout(timer); finish(null); };
    img.src = url;
  });
  imageCache.set(key, promise);
  return promise;
}

/** Load an image for plain <img> display (no CORS round-trip needed). */
export function loadImagePlain(url, opts = {}) {
  return loadImage(url, { crossOrigin: null, timeout: 12000, ...opts });
}

/** Probe a list of urls and report how many are actually reachable. */
export async function probeAssets(urls) {
  const results = await Promise.all(urls.map((u) => loadImage(u, { timeout: 6000 })));
  return { ok: results.filter(Boolean).length, total: urls.length };
}

/** True once the CDN answered at least one request (used to hide empty slots). */
let cdnState = 'unknown';
export function cdnStatus() { return cdnState; }
export async function detectCdn() {
  if (cdnState !== 'unknown') return cdnState;
  const res = await loadImage(skinIconUrl('f2e8f1cf-4f92-3eb1-e7e5-1d0f6a5b0b9e'), { timeout: 6000 });
  cdnState = res ? 'online' : 'offline';
  return cdnState;
}
