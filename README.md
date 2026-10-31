# COUNTER-STRIKE: BROWSER OPS

Tarayıcıda çalışan, kurulum gerektirmeyen **taktik FPS**. Gerçek Counter-Strike
haritaları, gerçek CS:GO silah kaplamaları, CS ekonomisi ve defuse kuralları —
hepsi tek bir `npm run dev` ile.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Ne var?

* **8 gerçek harita** — Dust II, Mirage, Inferno, Nuke, Ancient, Anubis, Vertigo,
  Train. Her arena resmî CS2 radar'ından üretilir: yürünebilir maske → çarpışma
  geometrisi + waypoint grafiği. HUD'daki radar da o haritanın gerçek radar'ı.
* **11 silah / 115 gerçek kaplama** — AK-47, M4A4, AWP, SSG 08, Desert Eagle,
  USP-S, Glock-18, P250, MP9, MAC-10, bıçak. Kaplamalar Valve'ın render'larıyla
  silaha bindirilir, ağ yoksa kendi deseniyle boyanır.
* **CS ekonomisi** — $800 başlangıç, öldürme $300, round $3250 / $1400, zırh,
  el bombaları (flash, smoke, molotov, HE).
* **Defuse modu** — C4 kurulumu 4 s, geri sayım 45 s, çözüm 7 s. İlk 5 round.
* **Botlar** — gerçek harita grafiğinde A* ile rota kurar, site tutar, plant/defuse
  yapar.

## Kontroller

| Tuş | İşlev |
| --- | --- |
| WASD / Shift / Ctrl | hareket / yürüme / çömelme |
| Sol tık / sağ tık | ateş / nişan (AWP & SSG 08 dürbün) |
| R / 1-2-3 / B | şarjör / slot / satın alma |
| Q E C X | flash · smoke · molotov · HE |
| F | C4 kur / çöz |

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | geliştirme sunucusu |
| `npm run build` | üretim paketi |
| `npm run check` | veri + harita + kaplama + UI + sahne testleri |
| `npm run maps` | radar'lardan haritaları yeniden üret |
| `npm run sim` | başsız maç simülasyonu (bot dengeleme) |

Varlıkların kaynağı ve lisans/atıf bilgisi: [ASSETS.md](ASSETS.md).
