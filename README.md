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
* **17 silah / 115 gerçek kaplama** — AK-47, M4A4, AUG, SG 553, Galil, FAMAS,
  AWP, SSG 08, Nova, XM1014, M249, MP9, MAC-10, UMP-45, MP7, Desert Eagle,
  P250, USP-S, Glock-18 ve bıçak. Kaplamalar Valve'ın render'larıyla silaha
  bindirilir, ağ yoksa kendi deseniyle boyanır.
* **Kaplama derinliği** — her kaplamanın float/aşınma derecesi (FN → BS) ve
  StatTrak öldürme sayacı vardır; sayaç profilde kalıcı olarak saklanır.
* **CS mekaniği**
  * MR12 maç yapısı: ilk 13 round, 12. roundda taraf değişimi.
  * Ekonomi: $800 başlangıç, öldürme $300, kazanma $3250, kaybetme serisi
    $1400 → $1700 → $2000 → $2300 → $2600 → $2900, tavan $16000.
  * Kevlar $650, Kevlar+Kask $1000 (yelek varsa kask yükseltmesi $350),
    Defuse Kit $400 (çözüm 10 s → 5 s).
  * Silaha özel **spray pattern** (AK/M4/SMG/tabanca), ilk mermi isabeti,
    hareket/havada sapma, vurulunca yavaşlama (tagging).
  * Fizikli el bombaları: sekme, fitil, duman (görüş hattını keser),
    flash (kör etme), molotov (alan hasarı), HE (mesafeye göre hasar).
* **Botlar** — gerçek harita grafiğinde A* ile rota kurar, site tutar, plant/defuse
  yapar, satın alma yapar ve el bombası kullanır. Ayarlardan zorluk seçilir
  (kolay / normal / zor).
* **Kariyer profili** — maç geçmişi, harita bazlı kazanma oranı, K/D, isabet,
  HS%, ADR, rating, en çok kullanılan silahlar; localStorage'da saklanır.
* **Nişangâh editörü** — renk, boşluk, uzunluk, kalınlık, dış çizgi, dinamik
  açılma ve canlı önizleme.

## Kontroller

| Tuş | İşlev |
| --- | --- |
| WASD / Shift / Ctrl | hareket / yürüme / çömelme |
| Sol tık / sağ tık | ateş / nişan (AWP & SSG 08 dürbün) |
| R / 1-2-3 / B | şarjör / slot / satın alma |
| Q E C X | flash · smoke · molotov · HE |
| F | C4 kur / çöz |
| V | silahı incele (kaplamayı göster) |
| Tab / Esc | skor tablosu / duraklat |

## Mimari

| Katman | Dosyalar | Ne yapar |
| --- | --- | --- |
| Harita verisi | `src/data/maps/*.js` (90.000+ satır) | CS2 radar'ından üretilmiş çarpışma kutuları, waypoint grafiği, cover skorları ve taktik noktaları — yükleme anında hesap yok |
| Oyun verisi | `src/data/ballistics.js`, `sprayLibrary.js`, `skinRecipes.js`, `callouts.js` | silah başına balistik/spray tabloları, 115 kaplamanın boya reçetesi, harita bölge isimleri |
| Motor | `src/game/*`, `src/world/*` | oyuncu, bot, mermi fiziği, el bombaları, C4, ekonomi, tur akışı |
| Arayüz | `src/ui/*` | menü, radar, satın alma, kaplama kasası, kariyer paneli |

Tüm bu tablolar elle yazılmaz: `npm run gen` ile üretilir.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | geliştirme sunucusu |
| `npm run gen` | harita + oyun verisini yeniden üretir |
| `npm run check` | 7 doğrulama (DOM, varlık, harita, kaplama, arayüz, sahne) |
| `npm run sim` | headless maç simülasyonu (botlar 5v5) |
| `npm run build` | üretim paketi |
| `npm run check` | veri + harita + kaplama + UI + sahne testleri |
| `npm run maps` | radar'lardan haritaları yeniden üret |
| `npm run sim` | başsız maç simülasyonu (bot dengeleme) |

Varlıkların kaynağı ve lisans/atıf bilgisi: [ASSETS.md](ASSETS.md).
