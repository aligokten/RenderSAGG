# Paneli web'de yayınlama

Panel, tek bir Node.js servisidir; kalıcı disk veya veritabanı gerektirmez. Aşağıdaki üç yoldan
biriyle tarayıcıdan erişilebilir bir adrese alınır.

## Yayınlamadan önce üç ayar

| Değişken | Neden önemli |
| --- | --- |
| `PANEL_PASSWORD` | **Boş bırakılırsa adresi bilen herkes panele girer ve sizin API anahtarınızı harcar.** Herkese açık adreste mutlaka doldurun. |
| `ALLOW_CLIENT_KEY` | `true` yapılırsa kullanıcı kendi API anahtarını panelden girer; maliyet sizde olmaz. Anahtar sunucuda saklanmaz ve loglanmaz. |
| `RATE_LIMIT_PER_HOUR` | IP başına saatlik üretim sınırı (varsayılan 20). `0` sınırsız demektir. |

Ekip içi kullanımda önerilen kurulum: `PANEL_PASSWORD` dolu + sunucuda kendi `GEMINI_API_KEY`'iniz.
Panelin linkini dışarıya vereceksiniz: `PANEL_PASSWORD` dolu + `ALLOW_CLIENT_KEY=true` + sunucuda anahtar yok.

---

## 1) Render.com (en kolay, GitHub'dan otomatik)

1. Bu depoyu GitHub'a gönderin (zaten gönderildi).
2. [render.com](https://render.com) → **New → Web Service** → depoyu seçin.
3. Render depodaki `render.yaml` dosyasını okur; build/start komutlarını kendisi doldurur.
4. **Environment** sekmesinde şunları girin:
   - `GEMINI_API_KEY` → kendi anahtarınız
   - `PANEL_PASSWORD` → paneli açacak şifre
   - `RENDER_PROVIDER` → `gemini` (veya `openai`)
5. Deploy bitince `https://<servis-adı>.onrender.com` adresi hazırdır.

Sağlık kontrolü `/healthz` üzerinden yapılır. Ücretsiz planda servis boşta uykuya geçer; uykudan
uyanan ilk istek birkaç saniye gecikir.

## 2) Fly.io (Docker, Avrupa bölgesi)

```bash
fly launch --no-deploy          # fly.toml'daki app adını kendinize göre değiştirin
fly secrets set GEMINI_API_KEY=... PANEL_PASSWORD=...
fly deploy
fly open
```

`fly.toml` içinde makine 1 GB bellekle tanımlıdır — 4K yükseltme bellek ister, 512 MB altına inmeyin.

## 3) Kendi sunucunuz / VPS (Docker Compose)

```bash
cp .env.example .env            # değerleri doldurun
docker compose up -d --build
```

Panel `http://sunucu-ip:3000` adresinde çalışır. Alan adı ve HTTPS için önüne Nginx/Caddy koyun:

```nginx
server {
    server_name render.alanadiniz.com;
    client_max_body_size 30M;               # yüklenen renderlar için
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;            # görsel üretimi uzun sürebilir
    }
}
```

`client_max_body_size` ve `proxy_read_timeout` değerlerini atlamayın: ilki yükleme boyutunu,
ikincisi üretim süresini keser.

---

## Kaynak gereksinimi

- **Bellek:** 1 GB önerilir. 4K PNG kodlaması tek işte ~300–500 MB kullanır.
- **Disk:** kalıcı disk gerekmez; işler bellekte tutulur ve `JOB_TTL_MINUTES` (varsayılan 60) sonunda silinir.
- **Ölçekleme:** iş kuyruğu bellekte olduğu için tek instance ile çalıştırın. Birden fazla instance
  açarsanız, bir istek işi başlatan sunucudan farklı bir sunucuya düşerse sonuç bulunamaz.

## Serverless (Vercel/Netlify) neden uygun değil

Panel, üretimi arka planda başlatıp durumunu `/api/jobs/:id` ile bildiren uzun soluklu bir iştir;
sonuç bellekte tutulur. Serverless fonksiyonlar istek bitince belleği bırakır ve genelde 10–60 sn
sınırı vardır. Bu mimariyi Vercel'e taşımak için işlerin harici bir depoya (S3/Redis) yazılması
gerekir — bu depoda uygulanmamıştır.

## Yayın sonrası kontrol

```bash
curl https://ADRESINIZ/healthz                 # {"ok":true,...}
curl https://ADRESINIZ/api/config              # şifre açıkken {"locked":true}
```

Tarayıcıda adrese girip şifreyle açın, küçük bir render yükleyip mock sağlayıcı ile bir kez üretin;
PNG indiriliyorsa kurulum tamamdır. Sonra `RENDER_PROVIDER` değerini `gemini`/`openai` yapın.
