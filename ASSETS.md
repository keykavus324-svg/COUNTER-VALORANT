# Varlık kaynakları — COUNTER-STRIKE: BROWSER OPS

Bu proje **hiçbir görseli elle çizmez**: haritalar, kaplamalar ve veriler
gerçek Counter-Strike kaynaklarından gelir.

## 1. Haritalar — resmî CS2 radar'ları

`assets-src/radar/<map>.png` + `<map>.txt` (HLTV overview: `pos_x`, `pos_y`,
`scale`, bombsite ve spawn koordinatları) →
`tools/buildmaps.mjs` →
`src/world/maps/<map>.js` (yürünebilir maske, gerçek spawn/bombsite noktaları) +
`public/art/csgo/maps/<map>.png` (HUD radarı ve menü galerisi).

Kaynak: **2mlml/cs2-radar-images** (CS2 oyun dosyalarından çıkarılmış resmî
radar görüntüleri ve overview dosyaları).

Üretim mantığı:

* radar pikselleri renk sınıfına göre ayrılır (renkli = zemin, gri = duvar),
* 0.5 m'lik grid'e indirgenir, duvarlar `greedy merge` ile kutuya çevrilir,
* en büyük bağlı bölge tutulur, T spawn'dan A/B'ye erişim garanti edilir,
* waypoint grafiği bu grid'den üretilir (botlar bu grafikte A* yapar).

| Harita | Boyut | Duvar | Waypoint |
| --- | --- | --- | --- |
| de_dust2 | 228×228 | 607 | 4863 |
| de_mirage | 260×260 | 370 | 2447 |
| de_inferno | 254×254 | 503 | 2788 |
| de_nuke | 364×364 | 466 | 3484 |
| de_ancient | 260×260 | 472 | 3888 |
| de_anubis | 271×271 | 711 | 4021 |
| de_vertigo | 208×208 | 344 | 2992 |
| de_train | 212×212 | 435 | 4009 |

## 2. Silah kaplamaları — gerçek CS:GO skinleri

`src/game/csgoSkins.js` — **ByMykel/CSGO-API** veri setinden üretilmiş 115
kaplama (11 silah): isim, nadirlik rengi ve Valve'ın `economy/image` render
adresi. Örnek: AK-47 | Redline, AWP | Dragon Lore, M4A4 | Howl, Desert Eagle |
Blaze, USP-S | Kill Confirmed, Glock-18 | Fade …

Uygulama katmanları:

1. **Boya + desen** — nadirlik/isim paletinden üretilen canvas dokusu (çevrimdışı
   da çalışır, silah asla gri kutu kalmaz),
2. **Gerçek render** — Valve CDN'den gelen kaplama görseli silahın iki yanına ve
   sırtına bindirilir,
3. **Kasa vitrini** — 3D turntable kaplamayı anında gösterir.

## 3. Çevrimdışı davranış

| Varlık | Kaynak | Ağ yoksa |
| --- | --- | --- |
| Harita radarı | depoda (public/art) | aynen çalışır |
| Harita geometrisi | depoda (üretilmiş) | aynen çalışır |
| Kaplama render'ı | Valve CDN | palet + desen boyaması |
| Ses | WebAudio ile üretilir | aynen çalışır |

## 4. Yeniden üretim

```bash
npm run maps     # assets-src/radar → src/world/maps + public/art
npm run check    # veri, harita, kaplama, UI ve sahne doğrulaması
```
