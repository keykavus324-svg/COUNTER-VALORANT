# COUNTER VALORANT

Tarayıcıda çalışan, **Valorant tarzı ajanlar + CS tarzı taktik 5v5 spike** modu.
Kurulum yok, indirme yok, harici dosya yok: harita, silahlar, karakterler, sesler ve
arayüz tamamen kodla (procedural) üretiliyor. Zayıf PC'ler için `low` kalite modu vardır.

> Hayran projesi / eğitim amaçlı. Riot Games veya Valve ile bağlantılı değildir.

---

## Hızlı Başlangıç

```bash
npm install        # sadece three + vite (dev)
npm run dev        # http://localhost:5173  (0.0.0.0:5173, telefondan da açılır)
```

Üretim derlemesi:

```bash
npm run build      # dist/ klasörü
npm run preview    # http://localhost:4173
```

İlk ekranda **OYNA** → ajan seç → **KİLİTLE** → maç başlar. Oyun tam ekran ve fare
kilidi ister: ekrana bir kez tıkla, `Esc` ile menüye dön.

---

## Oyun Modu

| Kural | Değer |
| --- | --- |
| Format | 5v5, spike kur/engelle |
| Kazanma | 5 round alan maçı kazanır |
| Taraf değişimi | 5. round sonunda |
| Satın alma süresi | 20 sn |
| Round süresi | 100 sn |
| Spike kurma | 4 sn (`F` basılı tut) |
| Spike çözme | 7 sn (`F` basılı tut) |
| Spike patlama | kurulumdan sonra 45 sn |

Round başlangıcında **B** ile satın alma menüsü açılır (silah, kalkan, yetenek şarjı).
Kredi kazanımı: round kazanma 3000₡, kaybetme 1900₡ (üst limit 9000₡).

## Kontroller

| Tuş | İşlev |
| --- | --- |
| `W A S D` | Hareket |
| `Shift` | Yürüme (sessiz) |
| `Ctrl` | Çömelme |
| `Space` | Zıplama (kasalara tırmanılabilir) |
| `Sol tık` | Ateş · basılı tutunca spray |
| `Sağ tık` | Nişan (ADS / dürbün) |
| `R` | Şarjör değiştir |
| `1 / 2 / 3` | Ana silah / tabanca / bıçak |
| `F` | Spike kur / çöz |
| `Q` `E` `C` | Ajan yetenekleri |
| `X` | Ulti |
| `B` | Satın alma menüsü |
| `Tab` | Skor tablosu |
| `Esc` | Duraklat / menü |

Ayarlardan hassasiyet, FOV, ses, kalite ve nişan imleci (renk, boşluk, uzunluk, nokta)
değiştirilebilir. Ayarlar `localStorage`'da saklanır.

---

## Ajanlar

| Ajan | Rol | Yetenekler (Q / E / C / X) |
| --- | --- | --- |
| **PHOENIX** | Duelist | Blaze · Curveball · Hot Hands · Run It Back |
| **OMEN** | Kontrolcü | Dark Cover · Paranoia · Shrouded Step · From the Shadows |
| **SOVA** | Başlatıcı | Recon Bolt · Shock Bolt · Owl Drone · Hunter's Fury |
| **SAGE** | Nöbetçi | Healing Orb · Barrier Orb · Slow Orb · Resurrection |

Ajan portreleri, silah skinleri ve harita görselleri **valorant-api** açık veri
setinden çalışma anında yüklenir (ayrıntı: `ASSETS.md`). Ağ yoksa oyun yerleşik
procedural görsellerle ve skine özel renk paletleriyle çalışmaya devam eder.

Takım arkadaşları KARTAL, DENİZ, MİRA, SARP; rakip takım VIPER, ROOK, NYX, KROW, SABLE.
Botlar rota bazlı saldırı kolları kullanır (A/B main, conn, mid), spike taşır, kurar,
çözer, düşen spike'ı alır ve patlama sonrası spike'ı korur.

## Silahlar

| Silah | Tip | Fiyat |
| --- | --- | --- |
| Classic | Tabanca | ücretsiz |
| Ghost | Tabanca | 500₡ |
| Sheriff | Tabanca | 800₡ |
| Spectre | SMG | 1600₡ |
| Judge | Pompalı | 1850₡ |
| Bulldog | Tüfek | 2100₡ |
| Vandal | Tüfek | 2900₡ |
| Phantom | Tüfek | 2900₡ |
| Operator | Dürbünlü | 4700₡ |
| Odin | Minigun | 3200₡ |

Her silahın kendine özgü tepme (recoil), yayılma, hareket cezası ve kafa çarpanı vardır.

### 73 orijinal skin

Ana menüdeki **SKIN KOLEKSİYONU** ekranından 10 silah için toplam 73 orijinal
Valorant kaplaması seçilebilir (Prime, Reaver, Elderflame, Glitchpop, Oni,
Spectrum, Gaia's Vengeance, Magepunk, RGX 11z Pro, Champions …).
Seçim kaydedilir ve maçta o silahı aldığında:

* kaplamanın **gerçek render'ı** silah modelinin iki yanına giydirilir
  (birinci şahıs modeli, botların silahları ve satın alma menüsü ikonları),
* aynı skine ait **renk paleti** gövde malzemesine uygulanır (metalik/pürüzlü ayarıyla),
* görsel indirilemezse yalnızca palet uygulanır — oyun çalışmaya devam eder.

### Harita galerisi

Ana menüdeki **HARİTALAR** ekranında 11 Valorant haritasının (Ascent, Bind, Haven,
Split, Icebox, Lotus, Sunset, Pearl, Breeze, Fracture, Abyss) resmi görseli ve
kısa tanıtımı yer alır. Ana menü ve yükleme ekranının arka planı da gerçek harita
görselleriyle döner.

## Harita — DUNE

Çöl temalı, simetrik olmayan 5 koridorlu harita (~66 × 66 m):
**A Main / A Conn / Mid / B Conn / B Main** → iki spike alanı → CT ve savunma spawn'ı.
Kutu, varil, kum torbası ve yükseklik farkları siper olarak kullanılır; minimap (`sol üst`)
duvarları, alanları, takım arkadaşlarını ve spike'ı gösterir.

---

## Teknik Yapı

```
index.html               arayüz iskeleti (menüler, HUD, satın alma, skor tablosu)
src/styles.css           Valorant esintili arayüz stilleri
src/main.js              giriş noktası: UI + maç yaşam döngüsü
src/core/utils.js        matematik / vektör yardımcıları
src/core/audio.js        procedural Web Audio motoru (silah, ayak sesi, spike bip, müzik)
src/world/Textures.js    canvas ile üretilen dokular (beton, kum, kasa, metal, gökyüzü)
src/world/mapLayout.js   saf veri: duvarlar, siperler, alanlar, spawn'lar, nav grafiği,
                         saldırı rotaları, hold noktaları
src/world/map.js         3D harita kurulumu, çarpışma, görüş hattı, yol bulma, minimap
src/game/weapons.js      silah istatistikleri + procedural silah modelleri
src/game/agents.js       ajanlar, yetenekler, portre SVG'leri
src/game/characters.js   procedural ajan karakter modelleri
src/game/actor.js        oyuncu/bot ortak fiziği, hitbox'lar, hasar
src/game/player.js       birinci şahıs kontrolü, kamera, ateş
src/game/Viewmodel.js    silah görünümü, tepme animasyonu
src/game/bot.js          bot yapay zekâsı (görüş, işitme, savaş, rota, spike)
src/game/effects.js      duman, ateş, patlama, izler
src/game/game.js         oyun döngüsü, round akışı, ekonomi, spike mantığı
src/ui/ui.js             HUD, menüler, satın alma, minimap, skor tablosu
tools/                   doğrulama ve simülasyon araçları (aşağıda)
```

### Doğrulama Araçları

```bash
npm run check                 # harita erişilebilirliği + DOM + UI smoke test
node tools/navcheck.mjs       # saldırı rotalarının engellere takılmadığını doğrular
node tools/check-layout.mjs   # tüm hedeflerin erişilebilir olduğunu doğrular
node tools/uicheck.mjs        # jsdom ile tüm arayüz fonksiyonlarını çalıştırır
node tools/domcheck.mjs       # ui.js'in istediği DOM id'leri index.html'de var mı
node tools/scenecheck.mjs     # 3D sahne bütünlüğü: eksik gövde/parça, kafa hitbox hizası
node tools/silhouette.mjs character blaze   # terminalde ASCII silüet (model kontrolü)
node tools/headless-sim.mjs   # THREE olmadan 5v5 maç simülasyonu, runtime hata avı
VERBOSE=1 node tools/headless-sim.mjs 600   # ayrıntılı kill/round logu
```

## Performans Notları

- Harici görsel/ses dosyası yok; tüm dokular 512 px canvas'tan üretilir.
- `Ayarlar → Grafik Kalitesi`: `low` gölgeleri ve bloom'u kapatır, `medium` dengeli,
  `high` gölge + bloom açar.
- Pixel ratio 1.5 ile sınırlı; render çözünürlüğü `low` modda 0.75×.
- Her maç yeni bir WebGL context (yeni `canvas`) üzerinde başlar; maç tekrarında
  context kaybı yaşanmaz.
