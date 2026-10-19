# Yayın: telefon sürümü + ortak liderlik tablosu

Oyunun online sürümü **GitHub Pages**'te (https://ahmetelcin.github.io/IAESTEGUESSER/),
ortak skor API'si **Netlify**'da (https://iaesteguesser.netlify.app/api), skorlar
**MongoDB Atlas**'ta durur. Oyun Netlify'da değil Pages'te: Netlify ücretsiz planda her
sayfaya gizlenemeyen bir rozet ekliyor; API sadece JSON döndürdüğü için etkilenmez.
Stant bilgisayarı aynı tabloya yazar, internet yoksa skorları kendinde biriktirip
bağlantı gelince gönderir.

## 0. GitHub Pages (bir kez)

1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   `VITE_MAPILLARY_TOKEN` (ve isteğe bağlı `VITE_ADMIN_PIN`).
3. **Actions → Pages → Run workflow** (sonra her push'ta kendiliğinden yayınlanır).

API ve site adresi `.github/workflows/pages.yml` içinde yazılı.

## 1. MongoDB Atlas (ücretsiz)

1. https://www.mongodb.com/cloud/atlas → hesap aç → **M0 (Free)** cluster oluştur.
2. **Database Access** → kullanıcı ekle (kullanıcı adı + güçlü şifre, rol: *Read and write to any database*).
3. **Network Access** → `0.0.0.0/0` ekle (Netlify Functions sabit IP kullanmaz).
4. **Connect → Drivers** → bağlantı dizesini kopyala:
   `mongodb+srv://KULLANICI:ŞİFRE@cluster0.xxxxx.mongodb.net/`

Bu dizeyi **hiçbir dosyaya yazma**; sadece Netlify panosuna gireceksin.

## 2. Netlify

1. Projeyi GitHub'a yükle (`.env` zaten git dışında).
2. https://app.netlify.com → **Add new site → Import from Git** → repoyu seç.
   Ayarlar `netlify.toml`'dan gelir: oyun derlenmez, sadece API fonksiyonu ve Pages'e
   yönlendiren kök sayfa yayınlanır.
3. **Site configuration → Environment variables**:

   | Ad | Değer | Not |
   |---|---|---|
   | `MONGODB_URI` | Atlas bağlantı dizesi | **sadece sunucu**, scope: *Functions* |
   | `MONGODB_DB` | `stajyer-nerede` | isteğe bağlı |

4. **Deploys → Trigger deploy**. Bitince kontrol:
   `https://<site>.netlify.app/api/scores?mapId=world&mode=moving&period=all` → `{"entries":[]}`

## 3. Stant derlemesi

Stant bilgisayarındaki `.env`'e ekle:

```
VITE_PUBLIC_URL=https://ahmetelcin.github.io/IAESTEGUESSER/
VITE_SCORES_API=https://iaesteguesser.netlify.app/api
```

Sonra `npm run build:stand`. Menüde QR kodu görünür, skorlar ortak tabloya gider.
`VITE_SCORES_API` boş kalırsa stant eskisi gibi sadece kendi skorlarını tutar.

## Notlar

- Sunucu her skoru doğrular: puan 0–25.000 (ve tur sayısı × 5000), isim 1–16 karakter,
  bilinen harita/mod, tarih en fazla 7 gün geriden. IP başına dakikada 10 skor.
  IP'ler hash'lenip 10 dakikada silinir.
- Aynı oyun iki kez gönderilse de bir kez kaydedilir (oyun kimliği).
- Admin panelindeki **Skorları sil** sadece o cihazı siler; ortak tabloyu temizlemek için
  Atlas'ta `scores` koleksiyonunu boşalt.
- Attract mode (60 sn'de menüye dönüş) sadece stant ve `npm run dev`'de açık; telefonda kapalı.
- Kulüp logosu: `src/assets/club-logo.svg` (veya `.png`/`.webp`) koyup yeniden derle.
