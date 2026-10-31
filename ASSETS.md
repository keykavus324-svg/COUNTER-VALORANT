# Görsel & Veri Kaynakları

Bu proje bir hayran projesidir ve Riot Games ile bağlantılı değildir.
Aşağıdaki **orijinal Valorant görselleri** çalışma zamanında (runtime) yüklenir:

| Ne | Kaynak | Kullanıldığı yer |
| --- | --- | --- |
| Silah skin renderları | `media.valorant-api.com/weaponskins/<uuid>/displayicon.png` | Skin koleksiyonu ekranı, satın alma menüsü ikonları, silah modellerindeki kaplama |
| Ajan portreleri | `media.valorant-api.com/agents/<uuid>/fullportrait.png` (+ `bustportrait`, `displayicon`) | Ajan seçim ekranı, HUD portresi, harita duvarlarındaki afişler |
| Harita görselleri | `media.valorant-api.com/maps/<uuid>/splash.png` ve `listviewicon.png` | Ana menü arka planı, yükleme ekranı, "Haritalar" galerisi |

UUID listeleri [valorant-api](https://valorant-api.com) açık veri setinden alınmıştır
ve `src/game/valoAssets.js` içinde saklanır.

## Çevrimdışı / engelli ağ davranışı

Hiçbir görsel zorunlu değildir:

* Skinler indirilemezse silahlar, skine özel **renk paletiyle** (Prime beyaz-altın,
  Reaver mor, Glitchpop neon, Elderflame turuncu …) boyanır (`palettes` in `src/game/skins.js`).
* Portreler yüklenmezse ajan seçim ekranı yerleşik SVG portrelere döner.
* Harita görselleri yüklenmezse menü, depodaki `public/art/menu-keyart.jpg` görselini kullanır.

## Depoda saklanan yerel görsel

* `public/art/menu-keyart.jpg` — menü için üretilmiş anahtar görsel (çevrimdışı yedek).
