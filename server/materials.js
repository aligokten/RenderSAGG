/**
 * Malzeme ve renk alternatifi kataloğu.
 *
 * Panel, yüklenen tek bir renderı burada tanımlı yüzey · malzeme · renk bileşenleriyle
 * çoğaltır. Her alternatif ayrı bir üretim işidir; geometri ve kamera her zaman korunur.
 *
 * `spec` metinleri doğrudan modele gider: doku ölçeği, derz/ek düzeni, yansıma-pürüzlülük
 * ve montaj karakteri malzeme bazında burada tanımlanır.
 */

/** Alternatif üretiminde hedeflenebilecek yüzey grupları. */
export const SURFACES = {
  facade: {
    id: 'facade',
    label: 'Cephe kaplaması',
    scope: 'exterior',
    rule: `HEDEF YÜZEY: Yapının dış cephe kaplaması (opak cephe yüzeyleri). Doğrama profilleri, cam,
çatı, saçak alt yüzeyi, korkuluk ve zemin döşemesi bu değişimin DIŞINDADIR.`
  },
  facadeAccent: {
    id: 'facadeAccent',
    label: 'Cephede vurgu yüzeyi',
    scope: 'exterior',
    rule: `HEDEF YÜZEY: Cephedeki vurgu/aksan yüzeyi (girinti, çıkma alnı, giriş nişi veya kolon-perde
gibi cephenin ikincil düzlemi). Ana cephe kaplaması, doğrama ve cam korunur.`
  },
  roof: {
    id: 'roof',
    label: 'Çatı kaplaması',
    scope: 'exterior',
    rule: `HEDEF YÜZEY: Çatı kaplaması. Çatı EĞİMİ, biçimi, mahya ve saçak geometrisi değişmez;
yalnızca kaplama malzemesi ve rengi değişir.`
  },
  joinery: {
    id: 'joinery',
    label: 'Doğrama ve profiller',
    scope: 'both',
    rule: `HEDEF YÜZEY: Kapı-pencere doğramaları ve profilleri. Doğrama KONUMU, boyutu, bölüntüsü ve
sayısı birebir korunur; yalnızca profil malzemesi ve rengi değişir. Cam korunur.`
  },
  glazing: {
    id: 'glazing',
    label: 'Cam',
    scope: 'both',
    rule: `HEDEF YÜZEY: Cam yüzeyler. Açıklık boyutu ve bölüntüsü değişmez. Cam siyah boşluk ya da
kusursuz ayna gibi görünmez; kontrollü yansımayla birlikte iç mekân derinliği okunur.`
  },
  hardscape: {
    id: 'hardscape',
    label: 'Dış zemin döşemesi',
    scope: 'exterior',
    rule: `HEDEF YÜZEY: Dış mekân sert zemin kaplaması (teras, yürüyüş yolu, otopark). Zemin
SINIRLARI, kotları ve havuz biçimi değişmez; yalnızca kaplama malzemesi, deseni ve rengi değişir.`
  },
  railing: {
    id: 'railing',
    label: 'Korkuluk ve metal elemanlar',
    scope: 'both',
    rule: `HEDEF YÜZEY: Korkuluk, küpeşte ve görünen metal elemanlar. Korkuluk YÜKSEKLİĞİ, dikme
aralığı ve geometrisi korunur; yalnızca malzeme ve renk değişir.`
  },
  pergola: {
    id: 'pergola',
    label: 'Gölgelik / pergola / güneş kırıcı',
    scope: 'exterior',
    rule: `HEDEF YÜZEY: Pergola, gölgelik ve güneş kırıcı (brise-soleil) elemanları. Eleman aralığı,
kesiti ve geometrisi korunur; yalnızca malzeme ve renk değişir. Gölge deseni malzemeyle tutarlı olur.`
  },
  interiorWall: {
    id: 'interiorWall',
    label: 'İç duvar yüzeyi',
    scope: 'interior',
    rule: `HEDEF YÜZEY: İç mekân duvar yüzeyleri. Duvar KONUMLARI, kapı-pencere açıklıkları, tavan ve
zemin korunur; yalnızca duvar kaplaması ve rengi değişir. Süpürgelik ve kartonpiyer düzeni bozulmaz.`
  },
  interiorFloor: {
    id: 'interiorFloor',
    label: 'İç zemin kaplaması',
    scope: 'interior',
    rule: `HEDEF YÜZEY: İç mekân zemin kaplaması. Zemin kotu, mekân sınırları ve mobilya yerleşimi
korunur; yalnızca kaplama malzemesi, döşeme deseni ve rengi değişir. Temas gölgeleri korunur.`
  },
  ceiling: {
    id: 'ceiling',
    label: 'Tavan yüzeyi',
    scope: 'interior',
    rule: `HEDEF YÜZEY: Tavan yüzeyi. Tavan YÜKSEKLİĞİ, kotları, ışık bandı ve armatür yerleşimi
korunur; yalnızca tavan kaplaması ve rengi değişir.`
  },
  cabinetry: {
    id: 'cabinetry',
    label: 'Mutfak / dolap yüzeyleri',
    scope: 'interior',
    rule: `HEDEF YÜZEY: Sabit mobilya, mutfak dolap kapakları ve gövde yüzeyleri. Dolap MODÜLLERİ,
boyutları, kapak bölüntüsü ve kulp düzeni korunur; yalnızca kapak malzemesi ve rengi değişir.`
  },
  counterTop: {
    id: 'counterTop',
    label: 'Tezgâh yüzeyi',
    scope: 'interior',
    rule: `HEDEF YÜZEY: Tezgâh ve varsa arka panel (bordür) yüzeyi. Tezgâh KALINLIĞI, kenar profili ve
eviye-ocak yerleşimi korunur; yalnızca malzeme ve rengi değişir.`
  },
  upholstery: {
    id: 'upholstery',
    label: 'Döşeme kumaşı ve tekstil',
    scope: 'interior',
    rule: `HEDEF YÜZEY: Oturma grubu döşemesi ve tekstil yüzeyleri. Mobilya BİÇİMİ, ölçüsü ve konumu
korunur; yalnızca kumaş türü ve rengi değişir. Kumaşta doğal kırışıklık, ağırlık ve dikiş izi bulunur.`
  },
  custom: {
    id: 'custom',
    label: 'Kendim yazacağım yüzey',
    scope: 'both',
    rule: `HEDEF YÜZEY: Aşağıda kullanıcının tanımladığı yüzey. Tanımın dışındaki hiçbir yüzey
etkilenmez; sınırlar belirsizse değişim yapılmaz ve sahne birebir korunur.`
  }
};

/**
 * Malzeme kataloğu.
 * `colorMode`: 'exact' → renk birebir uygulanır; 'tone' → renk yalnızca malzemenin doğal ton
 * aralığında yorumlanır (doğal taş, ahşap gibi malzemelerde gerçekçiliği korumak için).
 */
export const MATERIALS = {
  /* ---- Ahşap ---- */
  thermowood: {
    id: 'thermowood', label: 'Termowood (ısıl işlemli çam)', group: 'Ahşap', colorMode: 'tone',
    spec: 'Isıl işlemli çam lambri; 90–120 mm genişliğinde çıtalar, ince ve düzenli gölge derzi, mat-satine yüzey (pürüzlülük yüksek), yumuşak damar dokusu, damar yönü elemanın uzun eksenine paralel.'
  },
  oak: {
    id: 'oak', label: 'Meşe', group: 'Ahşap', colorMode: 'tone',
    spec: 'Doğal meşe; belirgin ama düzensiz damar, hafif gözenekli yüzey, mat lake koruma, damar deseni tekrar etmez, tonda parça parça doğal farklılık bulunur.'
  },
  walnut: {
    id: 'walnut', label: 'Ceviz', group: 'Ahşap', colorMode: 'tone',
    spec: 'Ceviz kaplama; koyu ve akışkan damar, sıcak kahve tonlarında derinlik, saten yüzey, düşük-orta yansıma, damar yönü sürekli ve okunur.'
  },
  iroko: {
    id: 'iroko', label: 'İroko / tik', group: 'Ahşap', colorMode: 'tone',
    spec: 'Dış mekân sert ağacı; sıkı damar, hafif yağlı satine yüzey, güneşte doğal grileşme eğilimi çok hafif, deck ve cephe çıtalarında düzenli derz.'
  },
  charredWood: {
    id: 'charredWood', label: 'Yakma ahşap (shou sugi ban)', group: 'Ahşap', colorMode: 'tone',
    spec: 'Yüzeyi karbonize edilmiş ahşap; kömürleşmiş yüzeyde ince çatlak dokusu (alligator pattern), derin mat siyah-antrasit, yansıma neredeyse yok, çıta derzleri net.'
  },
  wpc: {
    id: 'wpc', label: 'Ahşap görünümlü kompozit (WPC)', group: 'Ahşap', colorMode: 'exact',
    spec: 'Ahşap-plastik kompozit; homojen ton, hafif fırçalı yüzey dokusu, mat, damar deseni ahşaba göre daha düzenli ama görünür tekrar barındırmaz, düzenli montaj derzi.'
  },

  /* ---- Doğal taş ---- */
  travertine: {
    id: 'travertine', label: 'Traverten', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Traverten; doğal gözenek ve ince katman izleri, honlanmış mat yüzey, gerçek plaka ölçeğinde (ör. 60×120 cm) düşük kontrastlı derz, plakalar arasında doğal ton farkı.'
  },
  limestone: {
    id: 'limestone', label: 'Kireçtaşı', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Kireçtaşı; ince taneli homojen doku, mat yüzey, keskin fuga hatları, düşük yansıma, kum-bej ton aralığında yumuşak geçişler.'
  },
  marble: {
    id: 'marble', label: 'Mermer', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Mermer; damarlar plaka ölçeğine uygun büyüklükte ve yönü süreklidir, cilalı yüzeyde kontrollü yansıma, damar deseni tekrar etmez.'
  },
  basalt: {
    id: 'basalt', label: 'Bazalt', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Bazalt; koyu gri-antrasit, ince gözenekli mat yüzey, fırçalı veya honlanmış doku, düşük yansıma, gerçek plaka ölçeğinde derz.'
  },
  andesite: {
    id: 'andesite', label: 'Andezit', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Andezit; kaba taneli mat yüzey, gri-yeşilimsi ton, patlatma veya honlu doku, dış zeminde geniş fuga, ıslakken tonu koyulaşır.'
  },
  slate: {
    id: 'slate', label: 'Kayrak taşı', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Doğal kayrak; katmanlı ve düzensiz yüzey rölyefi, ince yarıklar, mat-yarı mat, plakalar farklı kalınlıkta ve doğal kenarlı.'
  },
  stoneCladding: {
    id: 'stoneCladding', label: 'Doğal taş duvar kaplaması (patlatma)', group: 'Doğal taş', colorMode: 'tone',
    spec: 'Patlatma taş duvar kaplaması; farklı boyda taş parçaları, gerçek harç derzi, üç boyutlu yüzey gölgesi, tekrar eden dizilim yok.'
  },

  /* ---- Beton ve sıva ---- */
  fairFacedConcrete: {
    id: 'fairFacedConcrete', label: 'Brüt beton (kalıp dokulu)', group: 'Beton ve sıva', colorMode: 'tone',
    spec: 'Brüt beton; kalıp panosu izleri gerçek modül ölçeğinde, kalıp bağlantı (kon) delikleri düzenli aralıkta, ince yüzey gözenekleri, mat ve hafif emici görünüm — plastik parlaklık yok.'
  },
  microCement: {
    id: 'microCement', label: 'Mikro beton', group: 'Beton ve sıva', colorMode: 'exact',
    spec: 'Mikro beton; derzsiz sürekli yüzey, mala izinden gelen çok hafif bulutlanma, mat-satine, düşük yansıma, homojen ton.'
  },
  renderPlaster: {
    id: 'renderPlaster', label: 'Taneli dış cephe sıvası', group: 'Beton ve sıva', colorMode: 'exact',
    spec: 'Mineral esaslı taneli dış cephe sıvası; 1–1.5 mm tane dokusu yakın planda okunur, tamamen mat, homojen renk, köşelerde keskin fuga profili.'
  },
  tadelakt: {
    id: 'tadelakt', label: 'Kireç sıva (tadelakt)', group: 'Beton ve sıva', colorMode: 'exact',
    spec: 'Kireç esaslı el sıvası; yumuşak dalgalı yüzey, mala izleriyle doğal ton geçişleri, ipeksi mat yüzey, keskin derz yok.'
  },

  /* ---- Seramik ve tuğla ---- */
  largePorcelain: {
    id: 'largePorcelain', label: 'Büyük ebat porselen', group: 'Seramik ve tuğla', colorMode: 'exact',
    spec: 'Büyük ebat porselen (ör. 120×280 cm); çok ince fuga, mat veya yarı mat yüzey, desen plaka ölçeğinde ve plakadan plakaya tekrar etmez.'
  },
  matteCeramic: {
    id: 'matteCeramic', label: 'Mat sırlı seramik', group: 'Seramik ve tuğla', colorMode: 'exact',
    spec: 'Mat sırlı seramik karo; gerçek karo ölçeğinde düzenli fuga, sırda çok hafif ton oynaması, düşük yansıma, kenarları hafif yumuşak.'
  },
  zellige: {
    id: 'zellige', label: 'El yapımı sırlı karo (zellige)', group: 'Seramik ve tuğla', colorMode: 'exact',
    spec: 'El yapımı sırlı karo; her parçada farklı sır kalınlığı, dalgalı yüzeyde canlı ama dağınık yansıma, düzensiz kenar ve ince fuga.'
  },
  terrazzo: {
    id: 'terrazzo', label: 'Terrazzo', group: 'Seramik ve tuğla', colorMode: 'exact',
    spec: 'Terrazzo; farklı boyda agrega taneleri rastgele dağılmış, honlanmış mat-satine yüzey, taneler yüzeyle aynı düzlemde, desen tekrar etmez.'
  },
  klinkerBrick: {
    id: 'klinkerBrick', label: 'Klinker tuğla', group: 'Seramik ve tuğla', colorMode: 'tone',
    spec: 'Uzun formatlı klinker tuğla; gerçek tuğla ölçeğinde düzenli örgü, çukur harç derzi, tuğladan tuğlaya doğal ton farkı, mat sert yüzey.'
  },
  handmadeBrick: {
    id: 'handmadeBrick', label: 'El yapımı tuğla', group: 'Seramik ve tuğla', colorMode: 'tone',
    spec: 'El yapımı tuğla; düzensiz kenar ve yüzey, canlı ton dağılımı, kalın harç derzi, örgüde hafif düzensizlik — desen tekrarı yok.'
  },

  /* ---- Metal ---- */
  anodizedAluminium: {
    id: 'anodizedAluminium', label: 'Eloksal alüminyum', group: 'Metal', colorMode: 'exact',
    spec: 'Eloksallı alüminyum; ince fırçalı yön dokusu, yarı mat metalik yansıma (pürüzlülük orta-düşük), keskin profil kenarları, düzenli montaj derzi.'
  },
  powderCoatedMetal: {
    id: 'powderCoatedMetal', label: 'Fırın boyalı metal', group: 'Metal', colorMode: 'exact',
    spec: 'Elektrostatik toz boyalı metal; homojen mat-satine yüzey, çok hafif portakal kabuğu dokusu, yansıma yumuşak ve dağınık, kenarlar keskin.'
  },
  cortenSteel: {
    id: 'cortenSteel', label: 'Korten çelik', group: 'Metal', colorMode: 'tone',
    spec: 'Korten çelik; kararlı pas tabakası, turuncu-kahve arası dokulu ton geçişleri, mat yüzey, panel derzleri net, akma izleri çok hafif.'
  },
  brushedStainless: {
    id: 'brushedStainless', label: 'Fırçalı paslanmaz çelik', group: 'Metal', colorMode: 'exact',
    spec: 'Fırçalı paslanmaz çelik; tek yönlü ince çizgi dokusu, anizotropik yansıma, orta-düşük pürüzlülük, çevreyi bulanık olarak yansıtır.'
  },
  copper: {
    id: 'copper', label: 'Bakır', group: 'Metal', colorMode: 'tone',
    spec: 'Bakır kaplama; sıcak kırmızı-kahve metalik ton, kenetli panel dizilimi, yüzeyde hafif ve düzensiz oksitlenme, orta yansıma.'
  },
  zincTitanium: {
    id: 'zincTitanium', label: 'Çinko-titan (kenetli)', group: 'Metal', colorMode: 'exact',
    spec: 'Kenetli çinko-titan kaplama; düzenli kenet aralığı, mat gri metalik yüzey, hafif düzlemsel dalgalanma, yumuşak ve geniş yansıma.'
  },
  expandedMesh: {
    id: 'expandedMesh', label: 'Delikli / genişletilmiş metal', group: 'Metal', colorMode: 'exact',
    spec: 'Delikli veya genişletilmiş metal panel; gerçek ölçekte düzenli delik deseni, arkasındaki yüzey deliklerden kısmen okunur, mat boyalı yüzey, panel derzleri net.'
  },

  /* ---- Cam ve panel ---- */
  clearLowE: {
    id: 'clearLowE', label: 'Düz şeffaf low-e cam', group: 'Cam ve panel', colorMode: 'exact',
    spec: 'Şeffaf low-e cam; nötr renk, kontrollü yansımayla birlikte iç mekân derinliği okunur, çok hafif yeşil-nötr kenar tonu, siyah boşluk veya ayna görünümü yok.'
  },
  tintedGlass: {
    id: 'tintedGlass', label: 'Füme / renkli cam', group: 'Cam ve panel', colorMode: 'exact',
    spec: 'Renkli (füme) cam; koyulaşmış ama saydam, yansıma ile iç görünüm dengeli, cam kalınlığı kenarda okunur, ayna etkisi abartılmaz.'
  },
  frostedGlass: {
    id: 'frostedGlass', label: 'Buzlu cam', group: 'Cam ve panel', colorMode: 'exact',
    spec: 'Asitle matlaştırılmış cam; ışığı yayan yarı saydam yüzey, arkasındaki kütleler bulanık siluet olarak okunur, yansıma yumuşak ve dağınık.'
  },
  hplPanel: {
    id: 'hplPanel', label: 'Kompakt lamina (HPL)', group: 'Cam ve panel', colorMode: 'exact',
    spec: 'Kompakt lamina cephe paneli; homojen mat yüzey, gerçek panel ölçeğinde açık derz (open joint) dizilimi, derz gölgesi net, panel kenarı ince ve keskin.'
  },
  fiberCement: {
    id: 'fiberCement', label: 'Fibercement panel', group: 'Cam ve panel', colorMode: 'exact',
    spec: 'Fibercement panel; ince çimento dokulu mat yüzey, düzenli panel bölüntüsü ve açık derz, görünür vida düzeni varsa eşit aralıklı.'
  },

  /* ---- Boya ---- */
  matteWallPaint: {
    id: 'matteWallPaint', label: 'Mat duvar boyası', group: 'Boya', colorMode: 'exact',
    spec: 'Mat iç cephe boyası; tamamen mat ve pürüzsüz yüzey, yansıma yok, duvar düzlemindeki ışık geçişleri yumuşak, rulodan gelen doku çok hafif.'
  },
  limewash: {
    id: 'limewash', label: 'Kireç badana (limewash)', group: 'Boya', colorMode: 'exact',
    spec: 'Kireç badana; bulutlanan ve katmanlı ton geçişleri, tamamen mat, fırça yönü hafif okunur, homojen olmayan doğal görünüm.'
  },

  /* ---- Tekstil ve döşeme ---- */
  linenFabric: {
    id: 'linenFabric', label: 'Keten kumaş', group: 'Tekstil', colorMode: 'exact',
    spec: 'Keten döşeme; görünür dokuma dokusu, doğal kırışıklık, mat yüzey, kenarlarda dikiş izi ve minderde ağırlığa bağlı yumuşak katlanma.'
  },
  boucle: {
    id: 'boucle', label: 'Bouclé', group: 'Tekstil', colorMode: 'exact',
    spec: 'Bouclé kumaş; ilmekli hacimli doku, yakın planda kabarık yüzey gölgesi, mat, yumuşak silüet, kenarlarda dokunun sürekliliği korunur.'
  },
  velvet: {
    id: 'velvet', label: 'Kadife', group: 'Tekstil', colorMode: 'exact',
    spec: 'Kadife; hav yönüne bağlı parlaklık değişimi, kıvrımlarda ipeksi ışık toplama, derin renk doygunluğu, yumuşak katlanma.'
  },
  leather: {
    id: 'leather', label: 'Deri', group: 'Tekstil', colorMode: 'tone',
    spec: 'Doğal deri; ince gözenek dokusu, kullanım kıvrımları, yarı mat yumuşak yansıma, dikiş hatları gerçek aralıkta.'
  },
  woolRug: {
    id: 'woolRug', label: 'Yün halı', group: 'Tekstil', colorMode: 'exact',
    spec: 'Yün halı; hav yüksekliği görünür, kenarda kalınlık okunur, mat yüzey, zemine oturmuş temas gölgesi, desen ölçeği gerçek.'
  },

  /* ---- Zemin ---- */
  parquet: {
    id: 'parquet', label: 'Ahşap parke (çubuk)', group: 'Zemin', colorMode: 'tone',
    spec: 'Çubuk ahşap parke; gerçek lamel ölçeğinde dizilim, ince mikro derz, mat lake yüzey, damar yönü mekânın uzun eksenine paralel, lameller arası doğal ton farkı.'
  },
  herringbone: {
    id: 'herringbone', label: 'Balık sırtı parke', group: 'Zemin', colorMode: 'tone',
    spec: 'Balık sırtı parke; gerçek ölçekte 45° dizilim, desen mekân eksenine hizalı, mat lake yüzey, lamellerde doğal damar ve ton farkı.'
  },
  outdoorPorcelain: {
    id: 'outdoorPorcelain', label: 'Dış mekân porselen', group: 'Zemin', colorMode: 'exact',
    spec: 'Dış mekân porselen (R11); mat ve tanecikli yüzey, gerçek plaka ölçeğinde düzenli fuga, ıslakken bile düşük yansıma.'
  },
  woodDeck: {
    id: 'woodDeck', label: 'Ahşap deck', group: 'Zemin', colorMode: 'tone',
    spec: 'Ahşap deck; eşit aralıklı çıtalar ve düzenli gölge derzi, çıta yönü sürekli, yarı mat yüzey, ıslak alanlarda tonu koyulaşır.'
  },
  cobbleStone: {
    id: 'cobbleStone', label: 'Granit küp taş', group: 'Zemin', colorMode: 'tone',
    spec: 'Granit küp taş; gerçek ölçekte kavisli veya düz dizilim, taşlar arasında kum-harç derzi, üst yüzeyler hafif düzensiz ve mat.'
  },
  gravel: {
    id: 'gravel', label: 'Çakıl', group: 'Zemin', colorMode: 'tone',
    spec: 'Dere çakılı; tane boyu gerçek ölçekte ve karışık, yüzeyde doğal dağılım, mat, kenarlarda bordür varsa hizası korunur.'
  },
  lawn: {
    id: 'lawn', label: 'Çim', group: 'Zemin', colorMode: 'tone',
    spec: 'Doğal çim; tane boyu gerçek ölçekte, yükseklik ve yoğunlukta hafif düzensizlik, kenarlarda bordüre temiz oturma, mat yüzey.'
  }
};

/** Panelde hazır sunulan renk paleti. */
export const COLOR_PALETTE = [
  { id: 'brokenWhite', name: 'Kırık beyaz', hex: '#F2EFE9' },
  { id: 'limeWhite', name: 'Kireç beyazı', hex: '#EAE7DE' },
  { id: 'bone', name: 'Kemik', hex: '#DDD6C6' },
  { id: 'sand', name: 'Kum', hex: '#D2C1A4' },
  { id: 'beige', name: 'Bej', hex: '#C8B394' },
  { id: 'taupe', name: 'Sıcak taupe', hex: '#9C8C7A' },
  { id: 'lightGrey', name: 'Açık gri', hex: '#C6C7C4' },
  { id: 'cementGrey', name: 'Çimento grisi', hex: '#9A9C99' },
  { id: 'anthracite', name: 'Antrasit', hex: '#3A3E42' },
  { id: 'charcoal', name: 'Kömür siyahı', hex: '#22252A' },
  { id: 'terracotta', name: 'Terracotta', hex: '#B5674A' },
  { id: 'brickRed', name: 'Kiremit', hex: '#9E4B33' },
  { id: 'cortenRust', name: 'Korten pası', hex: '#8A4A2C' },
  { id: 'mustard', name: 'Hardal', hex: '#C09A3E' },
  { id: 'olive', name: 'Zeytin yeşili', hex: '#6E7248' },
  { id: 'sage', name: 'Adaçayı yeşili', hex: '#9BA893' },
  { id: 'forest', name: 'Orman yeşili', hex: '#3B4F42' },
  { id: 'petrol', name: 'Petrol mavisi', hex: '#2F5560' },
  { id: 'navy', name: 'Gece mavisi', hex: '#26354D' },
  { id: 'burgundy', name: 'Bordo', hex: '#5E2A31' },
  { id: 'bronze', name: 'Bronz', hex: '#7A6247' },
  { id: 'champagne', name: 'Şampanya', hex: '#CDBFA6' },
  { id: 'naturalWood', name: 'Doğal ahşap tonu', hex: '#B98E5E' },
  { id: 'lightOak', name: 'Açık meşe', hex: '#C9A87C' },
  { id: 'walnutBrown', name: 'Ceviz kahvesi', hex: '#5B3B27' }
];

/** Bir alternatif setinde üretilebilecek en fazla versiyon sayısı. */
export const MAX_VARIANTS = 12;

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

const normalizeHex = (value) => {
  const match = HEX.exec(String(value || '').trim());
  if (!match) return null;
  const digits = match[1].length === 3
    ? match[1].split('').map((ch) => ch + ch).join('')
    : match[1];
  return `#${digits.toUpperCase()}`;
};

/** Yüzey tanımını çözer; `custom` için kullanıcı metni zorunludur. */
export function resolveSurface(input) {
  const id = typeof input === 'string' ? input : input?.id;
  const base = SURFACES[id] || SURFACES.facade;
  const note = String((typeof input === 'object' && input?.note) || '').trim().slice(0, 400);
  return { id: base.id, label: note && base.id === 'custom' ? note : base.label, rule: base.rule, note };
}

/**
 * Malzeme tanımını çözer. Katalog dışı bir malzeme serbest metin olarak kabul edilir;
 * bu durumda `spec` yerine kullanıcı açıklaması kullanılır ve renk birebir uygulanır.
 */
export function resolveMaterial(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const known = MATERIALS[input];
    return known ? { ...known, custom: false } : null;
  }
  const known = input.id ? MATERIALS[input.id] : null;
  if (known) {
    const note = String(input.note || '').trim().slice(0, 300);
    return { ...known, custom: false, note };
  }
  const label = String(input.label || input.note || '').trim().slice(0, 120);
  if (!label) return null;
  return {
    id: `custom:${label.toLowerCase()}`,
    label,
    group: 'Serbest tanım',
    colorMode: 'exact',
    custom: true,
    spec: String(input.spec || input.note || '').trim().slice(0, 400) ||
      'Malzeme gerçek dünya ölçeğinde, doğru doku ölçeği, derz düzeni ve yansıma-pürüzlülük değerleriyle uygulanır.'
  };
}

/** Renk tanımını çözer: palet kimliği, hex veya serbest ad kabul edilir. */
export function resolveColor(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const fromPalette = COLOR_PALETTE.find((color) => color.id === input);
    if (fromPalette) return { ...fromPalette };
    const hex = normalizeHex(input);
    return hex ? { id: hex, name: hex, hex } : { id: input, name: input.slice(0, 80), hex: null };
  }
  const hex = normalizeHex(input.hex);
  const fromPalette = COLOR_PALETTE.find((color) => color.id === input.id);
  const name = String(input.name || fromPalette?.name || hex || '').trim().slice(0, 80);
  if (!name && !hex) return null;
  return { id: input.id || hex || name, name: name || hex, hex: hex || fromPalette?.hex || null };
}

/**
 * Malzeme ve renk listelerinden alternatif kombinasyonlarını üretir.
 *
 * - `matrix` (varsayılan): her malzeme × her renk
 * - `paired`: listeler sırayla eşleştirilir (1. malzeme + 1. renk, 2. + 2. …)
 *
 * Listelerden biri boşsa yalnızca diğeri değiştirilir; ikisi de boşsa sonuç boş döner.
 */
export function buildCombinations({ materials = [], colors = [], pairing = 'matrix', limit = MAX_VARIANTS } = {}) {
  const mats = materials.map(resolveMaterial).filter(Boolean);
  const cols = colors.map(resolveColor).filter(Boolean);
  const out = [];

  if (mats.length && cols.length) {
    if (pairing === 'paired') {
      const count = Math.max(mats.length, cols.length);
      for (let i = 0; i < count; i += 1) {
        out.push({ material: mats[i % mats.length], color: cols[i % cols.length] });
      }
    } else {
      for (const material of mats) {
        for (const color of cols) out.push({ material, color });
      }
    }
  } else if (mats.length) {
    for (const material of mats) out.push({ material, color: null });
  } else if (cols.length) {
    for (const color of cols) out.push({ material: null, color });
  }

  return out.slice(0, Math.max(1, Math.min(limit, MAX_VARIANTS)));
}

/** Alternatifin panelde ve dosya adında görünen adı. */
export function combinationLabel({ material, color }) {
  const parts = [material?.label, color?.name].filter(Boolean);
  return parts.join(' · ') || 'Alternatif';
}

/** Panel arayüzüne gönderilen katalog. */
export function catalog() {
  return {
    surfaces: Object.values(SURFACES).map(({ id, label, scope }) => ({ id, label, scope })),
    materials: Object.values(MATERIALS).map(({ id, label, group, colorMode, spec }) => ({
      id, label, group, colorMode, spec
    })),
    colors: COLOR_PALETTE,
    maxVariants: MAX_VARIANTS
  };
}
