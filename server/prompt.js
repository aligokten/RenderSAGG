/**
 * Mimari render fotogerçekçileştirme ajanının kural seti ve prompt üreticisi.
 *
 * Temel ilke: MİMARİYİ KORU, SADECE GERÇEKÇİLİĞİ GELİŞTİR.
 */

export const CORE_RULES = `Sen mimari görselleştirme, mimari fotoğrafçılık, PBR malzemeler, aydınlatma, peyzaj ve
post-prodüksiyon konusunda uzman bir görsel üretim ajanısın. Görevin, verilen ham mimari renderı
mimari projeye SADIK KALARAK fotogerçekçi bir mimari fotoğrafa dönüştürmektir.

TEMEL İLKE: MİMARİYİ KORU, SADECE GERÇEKÇİLİĞİ GELİŞTİR.

DEĞİŞTİRİLEMEZ UNSURLAR (kullanıcı açıkça istemediği sürece birebir korunur):
- Yapının kütlesi, ölçüsü ve kat adedi
- Duvar, kolon, kiriş ve döşemeler
- Kapı ve pencere konumları, sayıları ve oranları
- Cephe boşlukları ve çıkmalar
- Balkon, teras, çatı ve saçaklar
- Merdiven ve korkuluklar
- Havuzun biçimi ve konumu
- Sabit mobilya, dolap ve tezgâhlar
- İç mekân yerleşimi
- Parsel ve sert zemin sınırları
- Kamera konumu, perspektif, lens ve kadraj

YASAK: Yeni kapı, pencere, balkon, kat, çatı, duvar veya taşıyıcı eleman ekleme. Var olan öğeleri
kaldırma, büyütme, küçültme ya da başka yere taşıma. Kaynak renderı farklı bir mimari projeye
dönüştürme. Referans görsellerin mimarisini bu projeye taşıma; referanslardan yalnızca malzeme,
renk, ışık, atmosfer, peyzaj ve fotoğrafik kalite alınır.

MALZEME STANDARTLARI:
- Malzemeler fiziksel olarak doğru ve gerçek dünya ölçeğinde olmalıdır.
- Dokular doğru ölçekte; taş ve ahşapta görünür desen tekrarı olmamalıdır.
- Ahşap damar yönü yapı elemanına uygun olmalıdır.
- Seramik ve taş derzleri gerçek ölçekte olmalıdır.
- Beton ve sıva plastik gibi görünmemeli; ince yüzey dokusu taşımalıdır.
- Metaller doğru yansıma ve pürüzlülük değerlerine sahip olmalıdır.
- Kumaşlarda doğal kırışıklık, ağırlık ve yumuşaklık bulunmalıdır.
- Camlar siyah boşluk ya da kusursuz ayna gibi olmamalı; kontrollü yansıma ile birlikte iç mekân
  derinliği okunmalıdır.
- Su yüzeylerinde doğal yansıma, kırılma ve çok hafif dalga bulunmalıdır.
- Yüzey kusurları yalnızca çok hafif ve gerçekçi düzeyde kullanılır; yoğun kir, pas, çatlak veya
  eskime eklenmez.

AYDINLATMA STANDARTLARI:
- Güneş yönü ve gölgeler kaynak render ile tutarlı olmalıdır.
- Gökyüzü ve güneş aynı zaman dilimini yansıtmalıdır.
- İç ve dış mekân pozlaması dengelenir; beyaz yüzeyler patlamaz, gölgelerde detay kaybolmaz.
- Temas gölgeleri (contact shadow) nesneleri zemine oturtur.
- Yapay ışıklar yalnızca sahnede görünen gerçek armatürlerden çıkar; kaynağı belirsiz ışık üretilmez.
- Aşırı turuncu gün batımı, yapay HDR görünümü ve yoğun lens flare kullanılmaz.

KAMERA STANDARTLARI:
- Kaynak kamera, perspektif ve kadraj korunur.
- Mimari düşey çizgiler düzgün ve paralel tutulur.
- Balık gözü, aşırı geniş açı ve kenar deformasyonu üretilmez.
- Mimariyi bulanıklaştıran alan derinliği kullanılmaz.
- Görüntü kırpılmaz; en-boy oranı korunur.

KALİTE EŞİĞİ: Eğri duvarlar, bozuk doğramalar, eriyen mimari elemanlar, kesilen kolonlar, bozuk
merdivenler, birleşmeyen korkuluklar, havada duran nesneler, anlamsız yazı ve deforme insan
figürleri kabul edilemez. Görsele yazı, logo, filigran veya çerçeve eklenmez.`;

export const MODES = {
  strict: {
    id: 'strict',
    label: 'Kesin Koruma Modu',
    hint: 'Geometri, kamera ve malzeme dağılımı korunur; sadece gerçekçilik geliştirilir.',
    rules: `ÇALIŞMA MODU: KESİN KORUMA MODU.
Geometri, kamera ve malzeme dağılımı birebir korunur. Yalnızca fotogerçekçilik geliştirilir:
doku kalitesi, malzeme fiziği, ışık-gölge doğruluğu, cam ve yansıma karakteri, gökyüzü ve atmosfer,
render gürültüsünün temizlenmesi, kenar tırtıklanmasının giderilmesi, renk dengesi ve netlik.
Sahneye yeni nesne, yeni bitki türü, yeni mobilya veya yeni dekorasyon EKLENMEZ. Var olan öğelerin
konumu ve oranı değişmez.`
  },
  presentation: {
    id: 'presentation',
    label: 'Sunum Modu',
    hint: 'Geometri korunur; atmosfer, peyzaj ve dekorasyon kontrollü biçimde zenginleştirilir.',
    rules: `ÇALIŞMA MODU: SUNUM MODU.
Mimari geometri, kamera ve açıklıklar birebir korunur. Atmosfer, peyzaj ve dekorasyon KONTROLLÜ
biçimde zenginleştirilebilir: gökyüzü ve bulut karakteri, bitkilendirme yoğunluğu, çevresel derinlik,
iç mekânda tekstil ve aksesuar detayı. Eklenen her öğe ölçeğe uygun ve zemine oturmuş olmalıdır.
Peyzaj cepheyi, kapıyı, pencereyi ve geçiş yollarını kapatmaz; havuz ve sert zemin geometrisini
değiştirmez. İnsan, araç, bisiklet ve evcil hayvan yalnızca ölçek okunurluğu için gerekliyse, arka
planda ve odak olmayacak biçimde kullanılır.`
  },
  revision: {
    id: 'revision',
    label: 'Revizyon Modu',
    hint: 'Yalnızca açıkça belirtilen mimari veya dekoratif değişiklik uygulanır.',
    rules: `ÇALIŞMA MODU: REVİZYON MODU.
Kullanıcının aşağıda açıkça belirttiği değişiklik uygulanır. Belirtilmeyen HER ŞEY birebir korunur:
kamera, perspektif, kadraj, tüm diğer yüzeyler, malzemeler, ışık, gölge, peyzaj ve mobilyalar.
Temel kural: YALNIZCA BELİRTİLEN ÖĞEYİ DEĞİŞTİR, GERİ KALAN HER ŞEYİ BİREBİR KORU.`
  },
  material: {
    id: 'material',
    label: 'Malzeme Alternatifi Modu',
    hint: 'Geometri ve kamera korunur; yalnızca belirtilen yüzeylerin malzemesi değişir.',
    rules: `ÇALIŞMA MODU: MALZEME ALTERNATİFİ MODU.
Geometri, kamera, açıklıklar, yerleşim ve aydınlatma kurgusu birebir korunur. Yalnızca kullanıcının
belirttiği yüzeylerin malzemesi değiştirilir. Yeni malzeme gerçek dünya ölçeğinde, doğru derz/ek
düzeni ve doğru yansıma-pürüzlülük değerleriyle uygulanır. Malzeme değişimi yüzey sınırlarının
dışına taşmaz; komşu yüzeyler etkilenmez.`
  }
};

export const SCENE_RULES = {
  exterior: `SAHNE TÜRÜ: DIŞ MEKÂN.
Gökyüzü, atmosferik derinlik, cam yansımaları, zemin kaplamaları, bitkilendirme ve çevresel katmanlar
geliştirilir. Peyzaj projenin konum ve iklimine uygun olmalı; mimari cepheyi kapatmamalı, kapı,
pencere ve geçiş yollarını engellememeli, yapının ölçeğini bozmamalıdır. Havuz ve sert zemin
geometrisi değişmez. Cephe kaplamalarında derz, ek yeri ve montaj detayları okunur olmalıdır.`,
  interior: `SAHNE TÜRÜ: İÇ MEKÂN.
Doğal pencere ışığı, dolaylı aydınlatma, ışığın yüzeylerden sekmesi, mobilya malzemeleri, kumaş
dokuları, cam ve metal detayları ile zemin yansımaları geliştirilir. Mobilyaların yeri değişmez, yeni
sabit mobilya eklenmez, mekânın işlevi değişmez, duvar kaldırılmaz, yeni kapı veya pencere açılmaz,
tavan ve zemin sistemi yeniden tasarlanmaz, aşırı dekorasyon yapılmaz. Pencere dışındaki manzara
patlamış beyaz olmamalı, dış mekân pozlaması dengelenmelidir.`,
  auto: `SAHNE TÜRÜ: Görselden otomatik belirlenecek. Sahne dış mekânsa gökyüzü, peyzaj, cephe ve çevresel
derinlik; iç mekânsa pencere ışığı, dolaylı aydınlatma, tekstil ve yüzey yansımaları önceliklidir.
Her iki durumda da mimari geometri ve kamera korunur.`
};

export const TIME_RULES = {
  auto: 'ZAMAN: Kaynak renderdaki ışık yönü ve zaman dilimi korunur. Belirsizse yumuşak doğal gündüz ışığı kullanılır.',
  day: 'ZAMAN: Yumuşak doğal gündüz ışığı, hafif bulutlu gökyüzü, dengeli ve okunaklı gölgeler.',
  goldenHour: 'ZAMAN: Alçak açılı sıcak ışık. Aşırı turuncu tonlama, yapay HDR ve yoğun lens flare kullanılmaz; beyaz dengesi doğal kalır.',
  overcast: 'ZAMAN: Kapalı hava. Yumuşak ve yönsüz ışık, düşük kontrast, ıslak olmayan mat yüzey karakteri, gölgeler yumuşak ve geniş.',
  dusk: 'ZAMAN: Alacakaranlık. Gökyüzü derin mavi, yapay ışıklar yalnızca sahnedeki gerçek armatürlerden gelir, iç ve dış pozlama dengelenir, pencereler patlamaz.',
  night: 'ZAMAN: Gece. Aydınlatma yalnızca sahnede görünen armatürlerden ve iç mekân sızıntısından gelir; kaynağı belirsiz ışık üretilmez, gölgelerde detay korunur.'
};

export const WEATHER_RULES = {
  auto: '',
  clear: 'HAVA: Açık, ince yüksek bulutlu gökyüzü.',
  cloudy: 'HAVA: Parçalı bulutlu gökyüzü, yumuşatılmış güneş ışığı.',
  rain: 'HAVA: Yağmur sonrası. Sert zeminlerde ıslaklık ve yansıma, gökyüzünde dağılan bulutlar; yağmur damlası efekti abartılmaz.',
  snow: 'HAVA: Kar. Yatay yüzeylerde birikmiş kar, soğuk beyaz dengesi; kar mimari detayları örtmez.'
};

export const NEGATIVE_PROMPT = [
  'yeni kapı, pencere, balkon, kat, çatı veya duvar eklemek',
  'mevcut açıklıkları kaldırmak, taşımak, büyütmek veya küçültmek',
  'kamera açısını, perspektifi veya kadrajı değiştirmek',
  'görüntüyü kırpmak veya en-boy oranını bozmak',
  'eğri duvar, eğik düşey çizgi, bombeli cephe',
  'eriyen veya deforme mimari elemanlar',
  'kesilen kolon, birleşmeyen korkuluk, bozuk merdiven',
  'havada duran mobilya, bitki veya nesne',
  'anlamsız yazı, tabela, logo, filigran, çerçeve',
  'deforme insan yüzü veya uzuvları',
  'balık gözü, aşırı geniş açı, kenar deformasyonu',
  'mimariyi bulanıklaştıran alan derinliği',
  'aşırı turuncu tonlama, yapay HDR, yoğun lens flare',
  'plastik görünümlü beton ve sıva',
  'tekrar eden doku deseni (tiling)',
  'siyah boşluk gibi veya kusursuz ayna gibi cam',
  'yoğun kir, pas, çatlak, eskitme'
];

/** Modele gönderilen referans görsellerin nasıl kullanılacağını anlatan blok. */
export const REFERENCE_RULES = `REFERANS GÖRSELLER: İlk görsel her zaman ham renderdır ve mimari kaynak odur. Sonraki görseller
yalnızca REFERANSTIR. Referanslardan sadece malzeme karakteri, renk paleti, ışık niteliği, atmosfer,
peyzaj türü ve fotoğrafik kalite alınır. Referanslardaki mimari biçim, kütle, açıklık düzeni, kat
adedi veya kamera açısı ASLA ham rendera taşınmaz.`;

const ASPECT_LABELS = {
  source: 'kaynak görselin oranı',
  '16:9': '16:9',
  '3:2': '3:2',
  '4:3': '4:3',
  '1:1': '1:1',
  '9:16': '9:16'
};

/**
 * Panel girdilerinden modele gönderilecek nihai talimatı üretir.
 *
 * @param {object} opts
 * @param {string} opts.mode              strict | presentation | revision | material
 * @param {string} opts.scene             auto | exterior | interior
 * @param {string} opts.time              TIME_RULES anahtarı
 * @param {string} opts.weather           WEATHER_RULES anahtarı
 * @param {string} opts.aspect            source | 16:9 | 3:2 | 4:3 | 1:1 | 9:16
 * @param {string} opts.userPrompt        Kullanıcının ek istekleri
 * @param {number} opts.referenceCount    Ham render dışındaki referans görsel sayısı
 * @param {{width:number,height:number}} [opts.source] Kaynak görsel boyutu
 * @returns {{system:string, instruction:string, negative:string[]}}
 */
export function buildPrompt(opts) {
  const {
    mode = 'strict',
    scene = 'auto',
    time = 'auto',
    weather = 'auto',
    aspect = 'source',
    userPrompt = '',
    referenceCount = 0,
    source = null
  } = opts || {};

  const modeDef = MODES[mode] || MODES.strict;
  const blocks = [
    CORE_RULES,
    modeDef.rules,
    SCENE_RULES[scene] || SCENE_RULES.auto,
    TIME_RULES[time] || TIME_RULES.auto
  ];

  const weatherRule = WEATHER_RULES[weather];
  if (weatherRule) blocks.push(weatherRule);

  if (referenceCount > 0) blocks.push(REFERENCE_RULES);

  if (aspect === 'source') {
    const dims = source ? ` (${source.width}x${source.height})` : '';
    blocks.push(`ÇIKTI ORANI: Kaynak görselin en-boy oranı${dims} birebir korunur. Kadraj kırpılmaz.`);
  } else {
    blocks.push(`ÇIKTI ORANI: ${ASPECT_LABELS[aspect] || aspect}. Kadraj kırpılarak değil, sahne kenarlardan
mimariye ve mevcut çevreye uygun biçimde GENİŞLETİLEREK bu orana ulaşılır. Mevcut mimari eleman
kesilmez, kamera konumu değişmez, eklenen alan mevcut zemin, gökyüzü ve peyzaj karakterinin devamı olur.`);
  }

  const trimmedUser = String(userPrompt || '').trim();
  if (trimmedUser) {
    blocks.push(`KULLANICININ EK TALEBİ (en yüksek öncelik — yalnızca burada yazılanı uygula, belirtilmeyen
her alanı birebir koru):
${trimmedUser}`);
  } else if (mode === 'revision' || mode === 'material') {
    blocks.push(`UYARI: Bu modda değiştirilecek öğe belirtilmemiştir. Hiçbir mimari veya malzeme değişikliği
yapma; yalnızca fotogerçekçiliği geliştir.`);
  }

  blocks.push(`ÜRETİLMEYECEKLER: ${NEGATIVE_PROMPT.join(', ')}.`);

  blocks.push(`ÇIKTI: Tek bir fotogerçekçi mimari fotoğraf üret. Görselde yazı, logo, filigran veya çerçeve
bulunmaz. Sonuç, kaynakla AYNI mimari projeyi, AYNI kamera açısından göstermelidir.`);

  return {
    system: CORE_RULES,
    instruction: blocks.join('\n\n'),
    negative: NEGATIVE_PROMPT
  };
}

/** Sonuç panelinde gösterilen kalite kontrol listesi. */
export const QC_CHECKLIST = [
  'Sonuç aynı mimari projeyi gösteriyor mu?',
  'Geometri ve kamera açısı korunmuş mu?',
  'Kapı, pencere, merdiven ve korkuluklar doğru mu?',
  'Malzeme ölçekleri gerçekçi mi?',
  'Işık yönü ve gölgeler tutarlı mı?',
  'Bitki ve mobilyalar zemine oturuyor mu?',
  'Dokularda belirgin tekrar var mı?',
  'Cam ve yansımalar doğal mı?',
  'İstenmeyen yeni bir mimari eleman oluşmuş mu?',
  'Yapay zekâ deformasyonu bulunuyor mu?'
];

/* ==================================================================================
 * MALZEME & RENK ALTERNATİFİ PAKETLERİ
 *
 * Panelde kullanıcı, referans render üzerine tıklayarak numaralı bölgeler tanımlar.
 * Her paket, bu numaralara malzeme/renk/doku referansı atar ve tek bir alternatif
 * render üretir. Kural: SADECE NUMARALANMIŞ BÖLGELERİN MALZEMESİ DEĞİŞİR.
 * ================================================================================== */

export const PACKAGE_RULES = `ÇALIŞMA MODU: MALZEME VE RENK ALTERNATİFİ PAKETİ.
Bu bir malzeme alternatifi sunumudur. Geometri, kamera, perspektif, kadraj, açıklıklar, mobilya
yerleşimi, peyzaj düzeni ve aydınlatma kurgusu BİREBİR KORUNUR. Yalnızca aşağıda numaralanmış
bölgelerin malzemesi, dokusu ve rengi değiştirilir.

Sahnenin geri kalanı, bir öncekiyle yan yana konabilecek kadar aynı kalmalıdır: güneş yönü, gölge
uzunlukları, gökyüzü, pozlama, beyaz dengesi, peyzaj ve tüm diğer yüzeyler değişmez. Bu görsel bir
karşılaştırma setinin parçasıdır; tek fark numaralanmış bölgelerdeki malzeme olmalıdır.`;

export const REGION_RULES = `BÖLGE SINIRI KURALLARI:
- Her bölge, verilen noktanın üzerinde bulunan yüzeyin TAMAMINI kapsar: aynı malzemeye ait sürekli
  yüzeyin doğal sınırlarına (derz, köşe, profil, kenar) kadar uygulanır.
- Değişim bu sınırların dışına TAŞMAZ. Komşu yüzeyler, doğrama, cam, korkuluk ve zemin etkilenmez.
- Aynı yapıda o yüzeyle aynı malzemeyi paylaşan diğer yüzeyler de tutarlı biçimde güncellenir;
  farklı malzemeye ait yüzeyler korunur.
- Numaralanmış bölge sayısı kadar değişiklik yapılır; listelenmeyen hiçbir yüzeye dokunulmaz.
- Yeni malzeme gerçek dünya ölçeğinde, doğru derz/ek düzeni ve doğru yansıma-pürüzlülük
  değerleriyle uygulanır; malzemenin ışığa tepkisi sahnedeki mevcut ışıkla tutarlı olur.
- Malzeme değişiminin yüzeye düşen gölge ve yansımalar üzerindeki etkisi fiziksel olarak doğru
  yansıtılır; ancak ışık kaynakları ve gölge yönü değişmez.

GÖRSELE İŞARET KOYULMAZ: Bölge numaraları, işaretçiler, oklar, çerçeveler, ölçü çizgileri veya
etiketler çıktı görselinde GÖRÜNMEZ. Numaralar yalnızca bu talimatta hangi yüzeyin kastedildiğini
tanımlamak içindir. Çıktı temiz bir mimari fotoğraftır.`;

export const SWATCH_RULES = `MALZEME REFERANS GÖRSELLERİ: Yüklenen malzeme görselleri (doku fotoğrafı, malzeme
kartelası, ürün fotoğrafı) yalnızca ilgili bölgenin DOKU, DESEN, RENK ve YÜZEY KARAKTERİ kaynağıdır.
Referans görselin kendi geometrisi, perspektifi, aydınlatması, arka planı, çerçevesi veya üzerindeki
yazı ve logolar sahneye TAŞINMAZ. Doku, hedef yüzeyin perspektifine ve gerçek dünya ölçeğine uygun
biçimde yeniden yerleştirilir; kartela görüntüsü olduğu gibi yüzeye yapıştırılmaz.`;

const positionText = (x, y) => {
  const px = Math.round(Math.max(0, Math.min(1, Number(x) || 0)) * 100);
  const py = Math.round(Math.max(0, Math.min(1, Number(y) || 0)) * 100);
  const horizontal = px < 34 ? 'sol' : px > 66 ? 'sağ' : 'orta';
  const vertical = py < 34 ? 'üst' : py > 66 ? 'alt' : 'orta';
  return `görselin sol kenarından %${px}, üst kenarından %${py} uzaklıktaki nokta (${vertical}-${horizontal} bölge)`;
};

/**
 * Tek bir malzeme paketi için modele gönderilecek talimatı üretir.
 *
 * @param {object} opts
 * @param {Array<object>} opts.regions   [{ number, label, x, y, material, color, note, swatchRef }]
 * @param {string} [opts.packageName]
 * @param {string} [opts.scene]          auto | exterior | interior
 * @param {string} [opts.time]
 * @param {string} [opts.weather]
 * @param {string} [opts.aspect]
 * @param {string} [opts.userPrompt]
 * @param {number} [opts.swatchCount]    Malzeme referans görseli sayısı
 * @param {{width:number,height:number}} [opts.source]
 * @returns {{instruction:string, negative:string[]}}
 */
export function buildPackagePrompt(opts) {
  const {
    regions = [],
    packageName = '',
    scene = 'auto',
    time = 'auto',
    weather = 'auto',
    aspect = 'source',
    userPrompt = '',
    swatchCount = 0,
    source = null
  } = opts || {};

  const blocks = [CORE_RULES, PACKAGE_RULES, SCENE_RULES[scene] || SCENE_RULES.auto];

  const timeRule = time === 'auto' ? TIME_RULES.auto : TIME_RULES[time];
  if (timeRule) blocks.push(timeRule);
  const weatherRule = WEATHER_RULES[weather];
  if (weatherRule) blocks.push(weatherRule);

  const header = packageName
    ? `NUMARALANMIŞ BÖLGELER VE UYGULANACAK MALZEMELER — "${packageName}" paketi (${regions.length} bölge):`
    : `NUMARALANMIŞ BÖLGELER VE UYGULANACAK MALZEMELER (${regions.length} bölge):`;

  const regionBlocks = regions.map((region) => {
    const lines = [];
    const title = region.label ? `BÖLGE ${region.number} — ${region.label}` : `BÖLGE ${region.number}`;
    lines.push(title);
    lines.push(`Konum: ${positionText(region.x, region.y)}. Bu noktanın üzerindeki yüzeyin tamamı bu bölgeye aittir.`);

    if (region.surfaceRule) lines.push(region.surfaceRule);

    if (region.material) {
      lines.push(`Uygulanacak malzeme: ${region.material.label}.`);
      if (region.material.spec) lines.push(`Malzeme karakteri: ${region.material.spec}`);
    }

    if (region.color) {
      const hex = region.color.hex ? ` (${region.color.hex})` : '';
      const exact = !region.material || region.material.colorMode !== 'tone';
      lines.push(
        exact
          ? `Renk: ${region.color.name}${hex} — bu renk birebir uygulanır; yüzeyin ışık altındaki ton geçişleri korunur.`
          : `Renk: ${region.color.name}${hex} — malzemenin doğal ton aralığında yorumlanır; malzemenin kendi damar/doku karakteri korunur, düz boya gibi görünmez.`
      );
    }

    if (region.swatchRef) {
      lines.push(
        `Malzeme referans görseli: ${region.swatchRef}. Bu bölgenin doku, desen ve renk kaynağı yalnızca bu görseldir.`
      );
    }

    if (!region.material && !region.color && !region.swatchRef) {
      lines.push('Bu bölge için malzeme belirtilmemiştir: bölge BİREBİR KORUNUR, hiçbir değişiklik yapılmaz.');
    }

    if (region.note) lines.push(`Ek not: ${region.note}`);

    return lines.join('\n');
  });

  blocks.push([header, ...regionBlocks].join('\n\n'));
  blocks.push(REGION_RULES);

  if (swatchCount > 0) blocks.push(SWATCH_RULES);

  if (aspect === 'source') {
    const dims = source ? ` (${source.width}x${source.height})` : '';
    blocks.push(`ÇIKTI ORANI: Kaynak görselin en-boy oranı${dims} birebir korunur. Kadraj kırpılmaz — alternatifler
yan yana karşılaştırılacağı için kadrajın birebir aynı kalması zorunludur.`);
  } else {
    blocks.push(`ÇIKTI ORANI: ${ASPECT_LABELS[aspect] || aspect}. Kadraj kırpılarak değil, sahne kenarlardan
genişletilerek bu orana ulaşılır; kamera konumu değişmez.`);
  }

  const trimmedUser = String(userPrompt || '').trim();
  if (trimmedUser) {
    blocks.push(`KULLANICININ EK TALEBİ (yalnızca burada yazılanı uygula, belirtilmeyen her alanı birebir koru):
${trimmedUser}`);
  }

  blocks.push(`ÜRETİLMEYECEKLER: ${NEGATIVE_PROMPT.join(', ')}, bölge numarası veya işaretçi çizmek, malzeme kartelasını olduğu gibi yüzeye yapıştırmak, belirtilmeyen yüzeylerin malzemesini değiştirmek.`);

  blocks.push(`ÇIKTI: Tek bir fotogerçekçi mimari fotoğraf üret. Kaynakla AYNI mimari projeyi, AYNI kamera
açısından, AYNI ışıkla göster; yalnızca numaralanmış bölgelerin malzemesi ve rengi farklı olsun.
Görselde yazı, numara, işaretçi, logo, filigran veya çerçeve bulunmaz.`);

  return { instruction: blocks.join('\n\n'), negative: NEGATIVE_PROMPT };
}

/** Alternatif paketleri için sonuç ekranındaki kalite kontrol listesi. */
export const PACKAGE_QC_CHECKLIST = [
  'Geometri, kamera açısı ve kadraj kaynakla birebir aynı mı?',
  'Işık yönü, gölgeler ve gökyüzü diğer alternatiflerle aynı mı?',
  'Yalnızca numaralanmış bölgeler değişmiş mi?',
  'Değişim yüzey sınırlarının dışına taşmış mı?',
  'Yeni malzemenin doku ölçeği ve derz düzeni gerçekçi mi?',
  'Malzemenin yansıma ve pürüzlülük karakteri doğru mu?',
  'Renk, yüklenen kartela/referans ile tutarlı mı?',
  'Dokularda belirgin tekrar (tiling) var mı?',
  'Görselde bölge numarası, işaretçi veya yazı kalmış mı?',
  'Alternatifler yan yana konduğunda yalnızca malzeme farkı okunuyor mu?'
];
