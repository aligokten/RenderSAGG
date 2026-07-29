# Mimari Render Fotogerçekçileştirme Paneli

Ham iç/dış mekân renderlarını **mimari projeye sadık kalarak** fotogerçekçi hale getiren web paneli.
Yüklenen görsel işlenir ve **indirilebilir 4K PNG** olarak sunulur.

Temel ilke: **MİMARİYİ KORU, SADECE GERÇEKÇİLİĞİ GELİŞTİR.**

## Panelde neler var

| Bölüm | İçerik |
| --- | --- |
| 1 · Ham render | Sürükle-bırak PNG/JPG/WEBP yükleme, boyut ve oran bilgisi |
| 2 · Referans görseller | En fazla 4 adet; yalnızca malzeme, renk, ışık, atmosfer ve peyzaj kaynağı olarak kullanılır |
| 3 · Çalışma modu | Kesin Koruma · Sunum · Revizyon · Malzeme Alternatifi |
| 4 · Sahne ayarları | Sahne türü, zaman, hava, en-boy oranı, çıktı çözünürlüğü, sağlayıcı |
| 5 · Ek isteklerim | Serbest prompt alanı + hazır ifade önerileri |
| Sonuç | Ham/sonuç karşılaştırma sürgüsü, çözünürlük künyesi, PNG indirme, kalite kontrol listesi, modele gönderilen talimatın tamamı |

## Kurulum

```bash
npm install
cp .env.example .env      # sağlayıcı ve API anahtarını girin
npm start                 # http://localhost:3000
```

Testler: `npm test`

## Web'de yayınlama

Panel tek bir Node servisidir; veritabanı veya kalıcı disk istemez. Render.com (`render.yaml`),
Fly.io (`fly.toml`) ve Docker Compose (`docker-compose.yml`) yapılandırmaları depoda hazırdır.
Adım adım kurulum: **[DEPLOY.md](DEPLOY.md)**.

Herkese açık bir adreste üç ayar önemlidir:

| Değişken | Etkisi |
| --- | --- |
| `PANEL_PASSWORD` | Panel şifresi. **Boş bırakılırsa adresi bilen herkes panele girip API anahtarınızı harcayabilir.** |
| `ALLOW_CLIENT_KEY` | `true` ise kullanıcı kendi API anahtarını panelden girer; anahtar sunucuda saklanmaz ve loglanmaz. |
| `RATE_LIMIT_PER_HOUR` | IP başına saatlik üretim sınırı (varsayılan 20, `0` = sınırsız). |

Şifre açıkken PNG indirme ucu da korumalıdır: panel dosyayı yetkili istekle çeker ve tarayıcıda
blob olarak indirir. İşler bellekte tutulduğu için panel **tek instance** olarak çalıştırılmalıdır.

## Görsel üretim sağlayıcıları

`.env` içindeki `RENDER_PROVIDER` ile seçilir; panelden de tek tek değiştirilebilir.

| Sağlayıcı | Anahtar | Not |
| --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` | Ham render + referanslar tek istekte gider, oran `imageConfig.aspectRatio` ile iletilir. **gemini-3 nesli görsel modellerde** `imageConfig.imageSize` ile 4K doğrudan üretilir; eski modellerde (`gemini-2.5-flash-image`) çıktı ~1K–2K olur. |
| `openai` | `OPENAI_API_KEY` | `gpt-image-1` `images/edits`, `input_fidelity: high`. Oran, desteklenen en yakın boyuta eşlenir. |
| `mock` | — | **Yapay zekâ üretimi değildir.** Yalnızca ton/kontrast/netlik düzeltmesi uygular; anahtarsız kurulumda panelin uçtan uca çalıştığını doğrulamak içindir. |

## Çözünürlük hakkında dürüstlük notu

Panel, hedef uzun kenarı modele de bildirir: `gemini-3` nesli görsel modellerde `imageConfig.imageSize`
(`1K`/`2K`/`4K`) gönderilir ve 4K **doğrudan** üretilir. Bu modeller kullanılmadığında — ya da model
istenen boyutu göz ardı ettiğinde — çıktı Lanczos ile hedefe yükseltilir ve ölçüsüne göre hafifçe
keskinleştirilir.

Sonuç ekranı her iki durumu ayırır: **modelin ürettiği gerçek çözünürlük** ile **nihai dosya boyutu**
ayrı satırlarda gösterilir, yükseltme yapıldıysa kaç kat olduğu yazılır. Yükseltme detay üretmez,
ölçek büyütür. Panel hiçbir yerde üretilmemiş bir çözünürlüğü üretilmiş gibi göstermez.

## Terminalden tek seferlik üretim testi

Paneli açmadan, gerçek sağlayıcıyla bir görsel üretip sonucu inceleyebilirsiniz:

```bash
GEMINI_API_KEY=... RENDER_PROVIDER=gemini \
  npm run render -- --input render.png --mode presentation --scene exterior \
                    --time day --prompt "Cephedeki ahşap kaplama termowood olsun."
```

Komut çıktıyı PNG olarak yazar; kaynak/model/nihai çözünürlükleri, yükseltme oranını ve kalite
kontrol listesini terminale basar. Anahtar yalnızca ortam değişkeninden okunur. Seçeneklerin tamamı:
`npm run render -- --help`.

## En-boy oranı davranışı

- **Kaynak oranı (varsayılan):** oran birebir korunur, kırpma yapılmaz.
- **Farklı oran:** sahne kırpılarak değil, kenarlardan genişletilerek hedefe getirilir; talimatta bu açıkça belirtilir.
- Model istenen orandan %1.5'ten fazla saparsa görsel **kırpılmaz**; sapma sonuç künyesinde uyarı olarak raporlanır.

## Desteklenmeyen dosyalar

SKP, MAX, RVT, PLN, DWG, DXF, 3DM, BLEND, FBX, OBJ, IFC gibi dosyaların geometrisi güvenilir biçimde
okunamaz; panel bu dosyaları reddeder ve mimariyi tahmin etmez. Bunun yerine PNG/JPG ham render, farklı
kamera açıları, clay render, normal/depth map, Material/Object ID pass, plan-kesit-görünüş PDF'leri ve
malzeme listesi istenir.

## Kural seti nerede

Tüm ajan kuralları `server/prompt.js` içinde tek yerde toplanmıştır:

- `CORE_RULES` — değiştirilemez mimari unsurlar, malzeme/aydınlatma/kamera standartları, kalite eşiği
- `MODES` — dört çalışma modunun kuralları
- `SCENE_RULES`, `TIME_RULES`, `WEATHER_RULES` — iç/dış mekân, zaman ve hava blokları
- `REFERENCE_RULES` — referans görsellerin sınırları
- `NEGATIVE_PROMPT` — üretilmeyecekler listesi
- `QC_CHECKLIST` — sonuç ekranındaki kalite kontrol maddeleri

Talimat metni sonuç ekranında “Modele gönderilen talimat” başlığı altında olduğu gibi görülebilir.

## API

| Uç | Açıklama |
| --- | --- |
| `GET /healthz` | Sağlık kontrolü (kimlik doğrulama istemez) |
| `POST /api/session` | Panel şifresini doğrular |
| `GET /api/config` | Sağlayıcılar, modlar, sınırlar, kalite kontrol listesi (kilitliyken yalnızca `{locked:true}`) |
| `POST /api/render` | İş başlatır (JSON, base64 görsel) → `202 { id }` |
| `GET /api/jobs/:id` | İş durumu, adımlar ve sonuç künyesi |
| `GET /api/jobs/:id/download` | Nihai PNG (`content-disposition: attachment`) |

İşler bellekte tutulur ve varsayılan olarak 60 dakika sonra silinir (`JOB_TTL_MINUTES`).

## Proje yapısı

```
server/
  index.js        HTTP sunucusu ve API uçları
  config.js       .env okuma, sınırlar, desteklenmeyen formatlar
  prompt.js       ajan kural seti ve talimat üreticisi
  image.js        sharp işlemleri: girdi hazırlama, 4K yükseltme, önizleme
  pipeline.js     doğrulama, iş kuyruğu, uçtan uca akış
  providers/      gemini · openai · mock
public/           panel arayüzü (bağımlılıksız HTML/CSS/JS)
test/             prompt · görüntü · pipeline · sunucu testleri
Dockerfile        üretim imajı (node:22-slim)
render.yaml       Render.com yapılandırması
fly.toml          Fly.io yapılandırması
docker-compose.yml  kendi sunucunuz için
DEPLOY.md         yayınlama kılavuzu
```
