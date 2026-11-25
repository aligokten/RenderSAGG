# Mimari Render Paneli

> Depoda ayrıca bağımsız bir saha uygulaması bulunur: **[FAM Pano](#fam-pano--şantiye-pano-ve-sigorta-kaydı-fam-pano)** — şantiye pano ve sigorta kaydı
> (https://aligokten.github.io/RenderSAGG/fam-pano/).

Ham iç/dış mekân renderlarını **mimari projeye sadık kalarak** işleyen web paneli. İki ekrandan oluşur:

| Ekran | Adres | İşi |
| --- | --- | --- |
| **Fotogerçekçileştirme** | `/` | Ham renderı fotogerçekçi mimari fotoğrafa dönüştürür |
| **Malzeme ve renk alternatifi paketleri** | `/paketler.html` | Aynı sahnenin farklı malzeme/renk/doku alternatiflerini üretir |

Malzeme paneli ayrıca **sunucusuz** olarak GitHub Pages üzerinde yayındadır:
**https://aligokten.github.io/RenderSAGG/malzeme-paneli/** — kurulum gerektirmez, kendi API
anahtarınızla çalışır. Ayrıntı: [Sunucusuz sürüm](#sunucusuz-s%C3%BCr%C3%BCm-github-pages).

Her iki ekranda da temel ilke aynıdır: **MİMARİYİ KORU, SADECE İSTENENİ DEĞİŞTİR.**

---

# 1 · Fotogerçekçileştirme ekranı

Yüklenen görsel işlenir ve **indirilebilir 4K PNG** olarak sunulur.

## Panelde neler var

| Bölüm | İçerik |
| --- | --- |
| 1 · Ham render | Sürükle-bırak PNG/JPG/WEBP yükleme, boyut ve oran bilgisi |
| 2 · Referans görseller | En fazla 4 adet; yalnızca malzeme, renk, ışık, atmosfer ve peyzaj kaynağı olarak kullanılır |
| 3 · Çalışma modu | Kesin Koruma · Sunum · Revizyon · Malzeme Alternatifi |
| 4 · Sahne ayarları | Sahne türü, zaman, hava, en-boy oranı, çıktı çözünürlüğü, sağlayıcı |
| 5 · Ek isteklerim | Serbest prompt alanı + hazır ifade önerileri |
| Sonuç | Ham/sonuç karşılaştırma sürgüsü, çözünürlük künyesi, PNG indirme, kalite kontrol listesi, modele gönderilen talimatın tamamı |

---

# 2 · Malzeme ve renk alternatifi paketleri (`/paketler.html`)

Tek bir 3D renderı, farklı malzeme ve renk kurgularıyla **karşılaştırılabilir alternatifler** hâlinde sunar.

## Akış

1. **Referans render yüklenir** (PNG/JPG/WEBP).
2. **Bölgeler işaretlenir:** render üzerinde değiştirilecek yüzeye tıklanır; her tıklama otomatik olarak
   **numaralanır** (1, 2, 3 …). İşaretçi sürüklenerek konumu düzeltilebilir, bölgeye ad verilebilir
   (“cephe kaplaması”, “tezgâh”) ve katalogdan yüzey türü seçilebilir.
3. **Paketler hazırlanır:** istenen sayıda paket eklenir. Her pakette, her bölge numarası için üç yol vardır
   ve birlikte de kullanılabilirler:
   - o numaraya ait **yükleme alanına malzeme görseli** (kartela, doku fotoğrafı, ürün fotoğrafı) yüklenir,
   - **katalogdan malzeme** seçilir (49 malzeme; her biri doku ölçeği, derz düzeni ve yansıma-pürüzlülük
     tanımıyla birlikte gider),
   - **renk** seçilir (25 renklik palet veya özel renk).
4. **“Versiyonu render et”** butonuna basılır: o paketin alternatif render sahnesi üretilir. “Tüm paketleri
   render et” bütün paketleri sırayla üretir.
5. Sonuçlar **karşılaştırma şeridinde** yan yana listelenir; büyük görünümde sürgü ile referans render ile
   karşılaştırılır ve her alternatif ayrı PNG olarak indirilir.

Paket kartındaki **Kopyala** düğmesi, bir paketi tüm atamalarıyla çoğaltır: tek bir yüzeyi değiştirip
seri alternatif üretmenin en hızlı yolu.

## Alternatiflerin karşılaştırılabilirliği

Talimat, alternatiflerin yan yana sunulacağını modele açıkça bildirir: geometri, kamera, kadraj, güneş
yönü, gölge uzunlukları, gökyüzü ve pozlama sabit tutulur; **yalnızca numaralanmış bölgelerin malzemesi
değişir.** Numaralar yalnızca talimatta kullanılır — çıktı görseline işaretçi, numara veya etiket
çizilmez.

Bölge konumu modele **oransal koordinat** (“sol kenardan %32, üst kenardan %61”) ve bölge adıyla
birlikte iletilir; işaretlenen yüzey, o noktadaki sürekli yüzeyin doğal sınırlarına kadar (derz, köşe,
profil) kapsanır. Bölgeye ad vermek doğru yüzeyin bulunmasını belirgin biçimde iyileştirir.

Yüklenen malzeme görselleri yalnızca **doku, desen, renk ve yüzey karakteri** kaynağıdır; kartelanın
kendi geometrisi, perspektifi, arka planı ve üzerindeki yazılar sahneye taşınmaz.

## Malzeme kataloğu

`server/materials.js` tek kaynaktır: **yüzey grupları** (cephe, çatı, doğrama, cam, dış zemin, korkuluk,
pergola, iç duvar, iç zemin, tavan, dolap, tezgâh, döşeme kumaşı, serbest tanım), **malzemeler** (ahşap,
doğal taş, beton ve sıva, seramik ve tuğla, metal, cam ve panel, boya, tekstil, zemin) ve **renk paleti**.

Katalogda olmayan bir malzeme için “Kendim yazacağım…” seçilir; serbest metin de aynı kural setiyle
işlenir. Doğal malzemelerde (ahşap, doğal taş, tuğla, korten) renk **düz boya gibi değil**, malzemenin
doğal ton aralığında yorumlanır — bu ayrım katalogda `colorMode` alanıyla tutulur.

---

# Sunucusuz sürüm (GitHub Pages)

Malzeme paneli, sunucu kurmadan doğrudan tarayıcıda çalışan bir sürüm olarak da yayınlanır:

**https://aligokten.github.io/RenderSAGG/malzeme-paneli/**

Nasıl çalışır: kural seti ve malzeme kataloğu sunucu sürümüyle **aynı dosyalardan** okunur
(`server/prompt.js` ve `server/materials.js` saf JavaScript'tir ve tarayıcıda da çalışır), görsel
işleme canvas ile yapılır, üretim isteği **doğrudan tarayıcıdan** Google Gemini'ye gider.

| | Sunucu sürümü | Sunucusuz sürüm (Pages) |
| --- | --- | --- |
| Kurulum | Node servisi gerekir | Yok — adresi açmak yeterli |
| API anahtarı | Sunucuda tutulur, kullanıcıya gösterilmez | Kullanıcının kendi tarayıcısında; hiçbir sunucuya gitmez |
| Görseller | Sunucuya yüklenir | Tarayıcıdan çıkmaz |
| Yükseltme | sharp · Lanczos (daha keskin) | canvas · adımlı bilineer |
| Panel şifresi, saatlik sınır | Var | Yok — herkes kendi anahtarıyla kullanır |
| Fotogerçekçileştirme ekranı | Var | Yok (yalnızca malzeme paneli) |
| Sağlayıcı | gemini · openai · mock | gemini (doğrulandı) · openai (tarayıcı CORS'una bağlı) · yerel demo |

Anahtarı olmayan biri **Yerel demo** sağlayıcısıyla akışın tamamını (bölge işaretleme, kartela
yükleme, "Versiyonu render et", karşılaştırma, PNG indirme) deneyebilir; bu modda görsel yapay zekâ
ile üretilmez ve malzeme değişmez.

Pages yapılandırması: **Settings → Pages → Source: `main` / `(root)`**. Depo kökü sunulduğu için
statik panel `server/` ve `public/` altındaki ortak dosyaları doğrudan içe aktarır — kural seti
kopyalanmaz. `test/browser-safe.test.js` bu iki modülün tarayıcı-uyumlu kalmasını denetler: birine
Node bağımlılığı eklenirse test kırılır.

---

# FAM Pano — şantiye pano ve sigorta kaydı (`/fam-pano/`)

Elektrikçinin **her şantiyedeki panolarını ve sigortalarını** kayıt altında tuttuğu sunucusuz saha
uygulaması: **https://aligokten.github.io/RenderSAGG/fam-pano/**

Kurulum gerektirmez; telefonda da masaüstünde de çalışır. Veriler cihazın tarayıcısında saklanır
(kayıtlar localStorage, fotoğraflar IndexedDB) ve hiçbir sunucuya gönderilmez.

## Veri modeli

| Kayıt | İçerik |
| --- | --- |
| **Şantiye** | Ad, kod, adres, işveren, elektrik yüklenicisi, şantiye şefi, elektrik sorumlusu, abone/sayaç no, trafo ve sözleşme gücü, durum (Aktif / Askıda / Tamamlandı), fotoğraflar |
| **Pano** | Kod, ad, tür (geçici şantiye ana/tali, ADP, kat, motor, asansör, kompanzasyon…), konum, durum, **besleyen pano ve besleyen devre** (pano ağacı), giriş cihazı ve anma akımı, giriş kaçak akım, kısa devre seviyesi (kA), topraklama sistemi, IP sınıfı, besleme kablosu, ray sayısı × modül, sorumlu, kontrol aralığı, fotoğraflar |
| **Devre / sigorta** | No (F1…), beslediği yer, yük türü, mahal, cihaz (MCB, RCBO, RCCB, MCCB, NH, motor koruma, kontaktör, parafudr…), eğri, anma akımı, kutup, faz, kesme kapasitesi, kaçak akım mA ve tipi, bağlı olduğu kaçak akım rölesi, kablo tipi/damar/kesit/uzunluk, kW, cos φ, **marka / seri / model (katalogdan)**, durum (Aktif / Yedek / Kapalı / Arızalı / Kilitli-LOTO) |
| **Kontrol** | Tarih, tür (görsel, RCD testi, topraklama, izolasyon, çevrim empedansı, termal kamera, sıkılık, yetkili periyodik kontrol), sonuç, ölçümler (RA Ω, Riso MΩ, Zs Ω, RCD ms/mA, °C), bulgular, yapılacaklar, fotoğraflar |
| **Olay** | Sigorta attı, arıza, değişim, bakım, LOTO kilitleme/açma, not — pano veya devre bazında, fotoğraflı |
| **Geçmiş** | Her ekleme/güncelleme/silme; kim, ne zaman, hangi alan neyden neye |

## Ekranlar

- **Özet:** aktif şantiye/pano/devre sayıları, kayıt hataları, geciken kontroller, LOTO'daki devreler, son olaylar ve değişiklikler.
- **Şantiye:** pano ağacı (hangi pano hangi panonun hangi devresinden besleniyor), tüm devreler, kontroller, olaylar, bilgiler, geçmiş.
- **Pano:** devre tablosu (arama/durum/faz/uyarı filtresi, tek dokunuşla 🔒 LOTO ve ⚡ "sigorta attı"), **pano önden görünümü** (DIN ray, modül genişliğiyle, kaçak akım grupları rölenin yanında), **yük ve faz** (L1/L2/L3 akımı, dengesizlik, giriş şalteri sınırı, en az yüklü faz önerisi), uyarılar, kontroller, olaylar, QR, geçmiş. Toplu devre ekleme (fazları sırayla dağıtır) ve panoyu devreleriyle kopyalama.
- **Etiket / liste (yazdır):** A4 pano kapağı devre listesi, tehlike şeridi, QR kod ve cihazların altına yapıştırılacak modül genişliğinde etiket şeridi.
- **Uyarılar, Kontroller (takvim + kayıtlar), LOTO, Katalog, Arama, Ayarlar.**

## Hazır ürün kataloğu (sigorta grubu)

Devre, toplu devre ve pano giriş formlarında teknisyen **Marka → Seri** seçer; cihaz türü, eğri, anma
akımı, kutup, kesme kapasitesi ve kaçak akım (mA, tip) seçenekleri o serinin katalog aralığına
daralır ve uygun değerler otomatik dolar. Seri dışı bir değer girilirse uyarı verilir.

| Marka | Seriler |
| --- | --- |
| Legrand | RX³ 4500, DX³ 6000, DX³ 10000 (MCB) · RX³ ID, DX³-ID (RCCB) · DX³ RCBO · DPX³ 160 / 250 (MCCB) · Parafudr Tip 2 |
| Siemens | 5SL6, 5SY4 (MCB) · 5SV3 (RCCB) · 5SU1 (RCBO) · 3VA1 (MCCB) · 3NA3 (NH gG) · 5SD7 (SPD) |
| Viko | MCB · RCCB · RCBO — *genel tanım* |
| Panasonic | MCB · RCCB · RCBO — *genel tanım* |
| Schneider Electric | Easy9, Acti9 iC60N / iC60H (MCB) · Easy9 RCCB, Acti9 iID · Acti9 iDPN N Vigi (RCBO) · EasyPact CVS (MCCB) · Acti9 iPRD |
| ABB | S200, S200M (MCB) · F200 (RCCB) · DS201 (RCBO) · Tmax XT1 (MCCB) · OVR T2 |
| Hager | MBN/MCN 6 kA, NBN/NCN/NDN 10 kA (MCB) · RCCB, RCBO — *genel tanım* |
| Eaton | xPole PL6 / PL7 (MCB) · xPole PF6 (RCCB) |

Katalog seri düzeyindedir ve sipariş kodu içermez; değerler üretici kataloglarındaki tipik aralıklardır.
**Genel tanım** işaretli kayıtlarda seri adı doğrulanmamıştır — teknisyen etiketteki model kodunu
"Model / ürün kodu" alanına yazar. **Katalog** ekranından listede olmayan seriler "Kendi ürünüm" olarak
eklenir (yerleşik bir seriden kopyalanarak da), bunlar yedek dosyasına dahildir. Katalog
`fam-pano/lib/catalog.js` içindedir.

Şantiye ve pano ekranındaki **Malzeme listesi**, kullanılan cihazları marka/seri/eğri/anma/kutup/mA
kombinasyonuna göre adetleriyle çıkarır ve CSV olarak indirilir.

## Otomatik denetimler

Kablo kesiti ↔ sigorta anma akımı (Cu/PVC, yöntem C, 30 °C; düzeltme faktörsüz), yük akımı ↔ anma akımı,
kesme kapasitesi ↔ pano kısa devre seviyesi, priz / ıslak hacim / seyyar / konteyner devrelerinde ≤30 mA
kaçak akım (kendi RCBO'su, bağlı RCCB, pano girişi veya üst pano zinciri), faz dengesizliği, giriş
şalteri kullanım oranı, üst–alt pano seçiciliği, mükerrer devre numarası, kontrol vadesi, LOTO sahibi.
Kurallar `fam-pano/lib/rules.js` içinde, testleri `test/fam-pano.test.js` içindedir.

> Denetimler kayıt hatalarını yakalamak içindir; elektrik projesinin, kısa devre/seçicilik hesabının ve
> yetkili kişinin periyodik kontrolünün yerini tutmaz.

## Yedek ve ekip içi paylaşım

**Ayarlar → Yedek indir** tüm kayıtları (isteğe bağlı fotoğraflarla) tek JSON dosyasına yazar.
**Birleştir** ile yüklemede aynı kimlikli kayıtlardan `updatedAt` değeri yeni olan korunur, diğerleri
eklenir; böylece birden çok cihaz dosya ile eşitlenebilir. **Tümünü değiştir** cihazdaki veriyi
yedekle değiştirir. Devre, kontrol ve geçmiş listeleri Excel uyumlu CSV olarak da dışa aktarılır.

QR kodu panonun bu uygulamadaki adresini taşır; kayıtlar cihazda tutulduğu için, QR'ı okutan cihazda
aynı yedeğin yüklü olması gerekir. QR üretimi `fam-pano/vendor/qrcode.js` (qrcode-generator 1.4.4,
MIT, Kazuhiko Arase) ile cihazda yapılır; şantiyede internet olmasa da çalışır.

---

# Ortak kurulum ve altyapı

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
| `RATE_LIMIT_PER_HOUR` | IP başına saatlik üretim sınırı (varsayılan 20, `0` = sınırsız). Her paket ayrı bir üretimdir; hatalı girdi kotadan düşmez. |

Şifre açıkken PNG indirme ucu da korumalıdır: panel dosyayı yetkili istekle çeker ve tarayıcıda
blob olarak indirir. İşler bellekte tutulduğu için panel **tek instance** olarak çalıştırılmalıdır.

## Görsel üretim sağlayıcıları

`.env` içindeki `RENDER_PROVIDER` ile seçilir; panelden de tek tek değiştirilebilir.

| Sağlayıcı | Anahtar | Not |
| --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash-image`. Ham render + referanslar tek istekte gider, oran `imageConfig.aspectRatio` ile iletilir. |
| `openai` | `OPENAI_API_KEY` | `gpt-image-1` `images/edits`, `input_fidelity: high`. Oran, desteklenen en yakın boyuta eşlenir. |
| `mock` | — | **Yapay zekâ üretimi değildir.** Yalnızca ton/kontrast/netlik düzeltmesi uygular; anahtarsız kurulumda panelin uçtan uca çalıştığını doğrulamak içindir. |

## Çözünürlük hakkında dürüstlük notu

Görsel modelleri bugün tipik olarak 1024–2048 piksel uzun kenarda üretim yapar. Panel çıktıyı Lanczos ile
istenen uzun kenara (varsayılan 3840 px = 4K) yükseltir ve ölçeğe bağlı ölçülü bir keskinleştirme uygular.
Sonuç ekranında hem **modelin ürettiği gerçek çözünürlük** hem de **nihai dosya boyutu** ayrı ayrı gösterilir:
yükseltme detay üretmez, ölçek büyütür. Panel hiçbir yerde üretilmemiş bir çözünürlüğü üretilmiş gibi göstermez.

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
- `PACKAGE_RULES`, `REGION_RULES`, `SWATCH_RULES` — malzeme paketi modu: numaralanmış bölgeler, bölge
  sınırları ve yüklenen malzeme görsellerinin sınırları
- `PACKAGE_QC_CHECKLIST` — paket sonuçları için kalite kontrol maddeleri

Malzeme, renk ve yüzey tanımları ise `server/materials.js` içindedir.

Talimat metni sonuç ekranında “Modele gönderilen talimat” başlığı altında olduğu gibi görülebilir.

## API

| Uç | Açıklama |
| --- | --- |
| `GET /healthz` | Sağlık kontrolü (kimlik doğrulama istemez) |
| `POST /api/session` | Panel şifresini doğrular |
| `GET /api/config` | Sağlayıcılar, modlar, sınırlar, malzeme/renk/yüzey kataloğu, kalite kontrol listeleri (kilitliyken yalnızca `{locked:true}`) |
| `POST /api/render` | Fotogerçekçileştirme işi başlatır (JSON, base64 görsel) → `202 { id }` |
| `POST /api/packages` | Malzeme paketi işi başlatır: render + numaralı bölgeler + bölge başına malzeme/renk/kartela → `202 { id }` |
| `GET /api/jobs/:id` | İş durumu, adımlar ve sonuç künyesi |
| `GET /api/jobs/:id/download` | Nihai PNG (`content-disposition: attachment`) |

İşler bellekte tutulur ve varsayılan olarak 60 dakika sonra silinir (`JOB_TTL_MINUTES`).

## Proje yapısı

```
server/
  index.js        HTTP sunucusu ve API uçları
  config.js       .env okuma, sınırlar, desteklenmeyen formatlar
  prompt.js       ajan kural seti ve talimat üreticileri (fotogerçekçileştirme + malzeme paketi)
  materials.js    yüzey grupları, malzeme kataloğu, renk paleti, kombinasyon üreticisi
  image.js        sharp işlemleri: girdi hazırlama, 4K yükseltme, önizleme
  pipeline.js     doğrulama, iş kuyruğu, uçtan uca akış
  providers/      gemini · openai · mock
index.html        GitHub Pages giriş sayfası
.nojekyll         Pages'in dosyaları olduğu gibi sunması için
malzeme-paneli/   sunucusuz (Pages) sürüm
  index.html      panel arayüzü
  app.js          panel mantığı
  lib/image.js    canvas ile hazırlama, yükseltme, önizleme
  lib/provider.js tarayıcıdan gemini · openai · yerel demo
  lib/pipeline.js paket üretim akışı (ortak kural setini içe aktarır)
public/
  index.html      fotogerçekçileştirme ekranı
  paketler.html   malzeme ve renk alternatifi paketleri ekranı
  app.js · paketler.js · styles.css   (bağımlılıksız HTML/CSS/JS)
test/             prompt · malzeme · görüntü · pipeline · sunucu testleri
Dockerfile        üretim imajı (node:22-slim)
render.yaml       Render.com yapılandırması
fly.toml          Fly.io yapılandırması
docker-compose.yml  kendi sunucunuz için
DEPLOY.md         yayınlama kılavuzu
```
