# Stajyer Nerede? — IAESTE stant oyunu

## Proje ne
IAESTE kulübünün tanıtım standında oynanacak, GeoGuessr tarzı bir web oyunu. Oyuncu 360° sokak görüntüsünde gezinir, dünya haritasına pin atar, mesafeye göre puan alır. Lokasyonlar IAESTE stajı yapılan ülkelerden seçilir.

- Ana kullanım: standdaki bilgisayar, Chrome, tam ekran, mouse + klavye.
- İkincil kullanım: telefondan oynanabilen online sürüm (QR ile).
- Arayüz dili: **Türkçe**. Kod ve commit mesajları İngilizce.
- Proje **sıfırdan** yazılacak. Önceki prototip yok sayılacak.

## Arayüz yönü: GeoGuessr oynanışı
Oyun ekranı tamamen sokak görüntüsü olmalı; arayüz onun üstünde ince, yarı saydam katmanlar halinde durmalı. Temiz, teknik, oyun hissi veren bir HUD. Dekoratif "tanıtım sayfası" havası olmasın.

GeoGuessr'ın marka adı, logosu, renk paleti ve görselleri kullanılmayacak; sadece oynanış ve yerleşim mantığı örnek alınacak. Kendi kimliğimiz: IAESTE mavisi tonları + tek bir vurgu rengi.

### Oyun ekranı
- **Tam ekran panorama** (mapillary-js), kenardan kenara.
- **Sağ üst durum çubuğu:** Tur `2 / 5` · Puan · Süre. Süre son 10 sn'de kırmızı ve yanıp söner.
- **Sol üst:** pusula (panoramanın yönüyle döner) + "başlangıca dön" butonu + zoom +/-.
- **Sağ alt mini harita:**
  - Fare üstüne gelince büyür, ayrılınca küçülür.
  - Kenarında boyut butonları (küçük/orta/büyük) ve "sabitle" iğnesi.
  - Tıklayınca pin; pin varken altındaki **TAHMİN ET** butonu aktif olur.
  - Tile: Esri World Street Map (anahtarsız; CARTO artık API anahtarı istiyor), attribution görünür.
- **Klavye:** Boşluk = tahmin et / sonraki tur, R = başlangıca dön, M = haritayı büyüt/küçült, +/- = zoom.

### Tur sonucu ekranı
- Üst ~%70: büyük harita, tahmin pini + gerçek konum pini + aradaki kesikli çizgi (çizgi animasyonla çizilir).
- Alt panel: kazanılan puan (sayaç animasyonu), **0–5000 ilerleme çubuğu**, mesafe, şehir/ülke, kısa IAESTE satırı ("Bu ülkede IAESTE stajı var — standımızda sor").
- **SONRAKİ TUR** butonu.

### Oyun sonu ekranı
- Tüm 5 turun pinleri ve çizgileri tek haritada.
- Tur tur tablo: şehir, mesafe, puan.
- Toplam puan + 25.000 üzerinden ilerleme çubuğu.
- Günün sıralamasındaki yeri.
- **YENİ OYUNCU** butonu.

### Ana menü
- Arka planda yavaşça dönen bir panorama (attract mode ile aynı bileşen).
- Oyuncu adı girişi + **OYNA**.
- Harita seçimi: **IAESTE Dünya** (varsayılan), **Avrupa**, **Türkiye**, şehir haritaları **Edirne** ve **Bursa** (5 tur da şehrin içinden). Yeterli verisi olmayan harita "Yakında" ile devre dışı görünür.
- Mod seçimi: **Hareketli** (gezinebilir), **Hareketsiz** (bulunduğun yerde dön), **NMPZ** (hareket, döndürme, zoom yok).
- Sağda günün liderlik tablosu (ilk 10).

## Teknik kararlar
- **Vite + TypeScript, framework yok.** Ekranlar küçük modüller; basit bir state machine (`menu → loading → round → result → summary`).
- **mapillary-js** (npm) ve **Leaflet** (npm). Mapillary attribution'ı zorunlu, kaldırılmayacak.
- **Token:** `.env` → `VITE_MAPILLARY_TOKEN`. `.env` git'e girmez, `.env.example` olur.
- **Stant derlemesi:** `vite-plugin-singlefile` ile tek HTML (`npm run build:stand`), çift tıkla çalışmalı.
- **Liderlik tablosu:** localStorage (try/catch). Faz 5'e kadar sunucu yok. Faz 5'te ortak tablo eklenir (aşağıya bak); localStorage yedek olarak kalır.
- **Puanlama:** haversine mesafe; `5000 * exp(-km / ölçek)`. Ölçek haritaya göre: Dünya 2000, Avrupa 800, Türkiye 250, Edirne 1,5, Bursa 3 (km). 150 m altı tam puan.
- **Testler:** Vitest — mesafe, puanlama, liderlik tablosu, state geçişleri.

## Klasör yapısı (hedef)
```
src/
  main.ts
  config.ts
  data/maps/{world,europe,turkey,edirne,bursa}.json   # lokasyonlar + pano ID'leri
  game/state.ts
  game/scoring.ts
  game/modes.ts                          # hareketli / hareketsiz / NMPZ kısıtları
  services/mapillary.ts
  services/leaderboard.ts
  ui/hud/        # durum çubuğu, pusula, mini harita
  ui/screens/    # menu, loading, round, result, summary, admin
  styles/
scripts/curate.ts                        # + scripts/cities.ts (şehir listeleri)
```

## Fazlar
Her fazın sonunda dur, kısaca özetle, onay bekle. Onaysız sonraki faza geçme.

### Faz 1 — İskelet ve tek tur
- Proje kurulumu, state machine, tam ekran panorama, mini harita, pin, tahmin, tur sonucu ekranı.
- Lokasyonlar şimdilik elle yazılmış 5–10 pano ID'si.
- scoring için Vitest testleri. `npm run dev` çalışsın.

### Faz 2 — Tam oyun akışı
- 5 tur, süre, oyun sonu ekranı, ana menü, liderlik tablosu.
- Pusula, başlangıca dön, zoom, klavye kısayolları.
- `npm run build:stand` çalışsın.

### Faz 3 — Lokasyon verisi
- `scripts/curate.ts`: şehir listesi alır, Mapillary API'den şehir başına 3–5 adet 360° pano çeker (2018 öncesini ele), harita JSON'larına yazar.
- Üç harita: IAESTE Dünya (40+ şehir), Avrupa, Türkiye (15+ şehir).
- Şehir haritaları (Faz 3'te eklendi): Edirne, Bursa. Şehrin tamamı taranır, noktalar birbirinden en uzak olacak şekilde seçilir (`CITY_MAPS` in `scripts/cities.ts`).
- **Kapsama notu (Ekim 2026):** Mapillary'de Türkiye'nin çoğunda 360° pano yok (Ankara, Antalya, Konya, Kayseri, Eskişehir… 0). Bu yüzden **Türkiye, Edirne ve Bursa haritaları düz (360° olmayan) görüntüleri de kabul eder**, varsa 360° tercih edilir (`FLAT_ALLOWED` in `scripts/cities.ts`). Dünya ve Avrupa sadece 360°. Yeni şehir eklemeden önce `npm run curate -- turkey --only <id>` ile dene.
- Bir sonraki turun panoramasını önceden yükle.
- **Not (Faz 2'den):** Mapillary Graph API, yoğun şehir merkezlerinde en küçük bbox'ta bile HTTP 500 ("reduce the amount of data") dönüyor; `limit` küçültmek işe yaramıyor. `curate.ts` bbox'ı küçük parçalara (ızgara) bölerek arasın, parça hata verirse daha da bölsün. Bu sayede Faz 1'de çıkarılan **Berlin ve Viyana geri eklensin**.

### Faz 4 — Modlar ve stant özellikleri
- Hareketli / Hareketsiz / NMPZ.
- Attract mode: 60 sn hareketsizlikte menüye dön, panorama dönsün.
- Hile önleme: viewer'da konumu ele veren link/bilgileri gizle (attribution kalır).
- Admin paneli (Ctrl+Shift+A): tur sayısı, süre, skorları silme, CSV dışa aktarma.

### Faz 5 — Telefon sürümü ve cila
- Dokunmatik düzen: harita alttan açılan panel.
- GitHub Pages/Netlify yayını + menüde QR kod.
- **Ortak liderlik tablosu:** MongoDB Atlas (ücretsiz katman) + Netlify Functions (`skor ekle`, `günün ilk 10'u`). Telefon ve stant aynı tabloyu görür.
  - Bağlantı bilgisi sadece sunucu tarafında (Netlify env); tarayıcıya ve git'e girmez.
  - Sunucu doğrulaması: puan 0–25.000, isim uzunluğu, istek sınırı.
  - Çevrimdışı yedek: API'ye ulaşılamazsa skor localStorage'a yazılır, bağlantı gelince gönderilir. Oyun asla sunucuyu beklemez.
- **Semt adları (şehir haritaları):** `curate` sırasında her noktanın semt/mahalle adı Nominatim (OpenStreetMap) ters geocoding ile **bir kez** alınıp harita JSON'una yazılsın (`district` alanı); oyun çalışırken istek atılmaz.
  - Nominatim kullanım kurallarına uy: en fazla 1 istek/sn, tanımlayıcı `User-Agent`, sonuçları önbelleğe al (aynı nokta tekrar sorgulanmasın).
  - Oyun sonu tablosunda ve tur sonucunda şehir haritalarında "Edirne, Türkiye" yerine semt gösterilsin (ör. "Kaleiçi, Edirne"). Semt bulunamazsa şehir adına düşülsün.
- Ses efektleri (kapatılabilir), geçiş animasyonları, kulüp logosu için yer.

## Kurallar
- Token'ı koda gömme, commit'leme.
- `alert/confirm/prompt` yok; onaylar sayfa içinde.
- Her faz sonunda `npm run test` ve build geçmeli.
- Arayüz metinleri Türkçe ve kısa.
