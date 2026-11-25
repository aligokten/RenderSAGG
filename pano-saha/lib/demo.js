/**
 * Örnek veri: tek bir konut şantiyesi, geçici şantiye panoları ve tipik devreler.
 * Gerçek bir projeye ait değildir.
 */
export function loadDemo(store) {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  const site = store.create('sites', {
    name: 'Yeşilvadi Konutları — B Blok',
    code: 'YV-B',
    address: 'Örnek Mah. 1. Cad. No:5, Kartal / İstanbul',
    client: 'Örnek Yapı A.Ş.',
    contractor: 'Örnek Elektrik Ltd.',
    siteChief: 'Şantiye şefi',
    electricalLead: 'Elektrik sorumlusu',
    phone: '',
    status: 'Aktif',
    startDate: daysAgo(120),
    transformerKva: 400,
    utilityNo: 'ŞNT-000123',
    notes: 'Geçici şantiye elektriği: dağıtım şirketinden 160 kW şantiye aboneliği.'
  });
  const site2 = store.create('sites', {
    name: 'Merkez Ofis Tadilatı',
    code: 'MO-1',
    address: 'Ataşehir / İstanbul',
    client: 'Örnek Holding',
    status: 'Tamamlandı',
    startDate: daysAgo(300),
    endDate: daysAgo(40)
  });

  const sp = store.create('panels', {
    siteId: site.id,
    code: 'ŞP-0',
    name: 'Şantiye ana panosu',
    type: 'Şantiye ana panosu (geçici)',
    location: 'Şantiye girişi, sayaç yanı',
    status: 'Devrede',
    mainDevice: 'MCCB 3P',
    mainRating: 250,
    mainRcdMa: 300,
    shortCircuitKa: 10,
    earthingSystem: 'TN-S',
    voltage: '400/230 V',
    ipClass: 'IP65',
    feedCable: 'NYY 3x120/70 (sayaçtan)',
    manufacturer: 'Örnek Pano',
    rows: 2,
    modulesPerRow: 18,
    responsible: 'Elektrik sorumlusu'
  });

  const add = (panel, list) =>
    list.map(([code, label, loadKind, device, curve, rating, poles, phase, cable, kw, extra = {}]) => {
      const [cableType, cableSection] = cable ? cable.split(' ') : ['', ''];
      return store.create('circuits', {
        siteId: panel.siteId,
        panelId: panel.id,
        code,
        label,
        loadKind,
        device,
        curve,
        rating,
        poles,
        phase,
        cableType,
        cableSection: cableSection ? Number(cableSection) : '',
        loadKw: kw,
        breakingKa: extra.breakingKa ?? (rating > 63 ? 25 : 10),
        status: 'Aktif',
        ...extra
      });
    });

  const spCircuits = add(sp, [
    ['F1', 'Kule vinç panosu', 'Tali pano beslemesi', 'MCCB (kompakt şalter)', '', 125, '3P', '3F', 'NYY 50', 55, { breakingKa: 25 }],
    ['F2', 'Konteyner ofis panosu', 'Tali pano beslemesi', 'MCB (otomatik sigorta)', 'C', 63, '3P+N', '3F', 'NYY 16', 24],
    ['F3', 'Kat geçici panosu (B Blok)', 'Tali pano beslemesi', 'MCB (otomatik sigorta)', 'C', 63, '3P+N', '3F', 'H07RN-F 16', 30],
    ['F4', 'Beton pompası prizi', 'Motor / pompa', 'Motor koruma şalteri', '', 32, '3P', '3F', 'H07RN-F 6', 15],
    ['F5', 'Saha aydınlatma projektörleri', 'Aydınlatma', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', 'L1', 'NYY 2.5', 2.4],
    ['F6', 'Güvenlik kulübesi', 'Konteyner / ofis', 'RCBO (kaçak akımlı otomatik)', 'C', 16, '1P+N', 'L2', 'NYY 2.5', 2.5, { rcdMa: 30, rcdType: 'A' }],
    ['F7', 'Kaynak prizi (CEE 32A)', 'Kaynak makinesi', 'MCB (otomatik sigorta)', 'C', 32, '3P+N', '3F', 'H07RN-F 4', 12],
    ['F8', 'Yedek', 'Diğer', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', '', '', 0, { status: 'Yedek', label: '' }],
    ['SPD', 'Parafudr Tip 2', 'Diğer', 'Parafudr (SPD)', '', 40, '3P+N', '3F', 'NYAF 10', 0]
  ]);

  const vinc = store.create('panels', {
    siteId: site.id,
    code: 'VP-1',
    name: 'Kule vinç panosu',
    type: 'Mekanik / motor panosu',
    location: 'Kule vinç ayağı',
    status: 'Devrede',
    parentPanelId: sp.id,
    parentCircuitId: spCircuits[0].id,
    mainDevice: 'Yük ayırıcı 3P',
    mainRating: 125,
    mainRcdMa: 300,
    shortCircuitKa: 10,
    earthingSystem: 'TN-S',
    voltage: '400 V',
    ipClass: 'IP55',
    rows: 1,
    modulesPerRow: 12
  });
  add(vinc, [
    ['F1', 'Vinç ana besleme', 'Vinç / kule vinç', 'MCCB (kompakt şalter)', '', 100, '3P', '3F', 'NYY 35', 50, { breakingKa: 25 }],
    ['F2', 'Vinç kabin aydınlatma', 'Aydınlatma', 'MCB (otomatik sigorta)', 'B', 10, '1P+N', 'L1', 'NYM 1.5', 0.4]
  ]);

  const ofis = store.create('panels', {
    siteId: site.id,
    code: 'KP-1',
    name: 'Konteyner ofis panosu',
    type: 'Şantiye tali panosu (geçici)',
    location: 'Ofis konteyneri, giriş',
    status: 'Devrede',
    parentPanelId: sp.id,
    parentCircuitId: spCircuits[1].id,
    mainDevice: 'Yük ayırıcı 4P',
    mainRating: 63,
    shortCircuitKa: 6,
    earthingSystem: 'TN-S',
    voltage: '400/230 V',
    ipClass: 'IP40',
    rows: 2,
    modulesPerRow: 12
  });
  const ofisC = add(ofis, [
    ['RCD1', 'Prizler kaçak akım grubu', 'Diğer', 'RCCB (kaçak akım rölesi)', '', 40, '3P+N', '3F', '', 0, { rcdMa: 30, rcdType: 'A' }],
    ['F1', 'Ofis aydınlatma', 'Aydınlatma', 'MCB (otomatik sigorta)', 'B', 10, '1P+N', 'L1', 'NYM 1.5', 0.8],
    ['F2', 'Ofis prizleri', 'Priz', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', 'L1', 'NYM 2.5', 2.2],
    ['F3', 'Klima 1', 'Isıtma / klima', 'MCB (otomatik sigorta)', 'C', 20, '1P+N', 'L2', 'NYM 2.5', 3.5],
    ['F4', 'Klima 2', 'Isıtma / klima', 'MCB (otomatik sigorta)', 'C', 20, '1P+N', 'L2', 'NYM 2.5', 3.5],
    ['F5', 'Soyunma / duş konteyneri', 'Islak hacim prizi', 'MCB (otomatik sigorta)', 'C', 25, '1P+N', 'L3', 'NYM 2.5', 4.5],
    ['F6', 'Termosifon', 'Isıtma / klima', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', 'L3', 'NYM 2.5', 2]
  ]);
  const rcd = ofisC[0];
  store.update('circuits', ofisC[2].id, { protectedBy: rcd.id });
  store.update('circuits', ofisC[5].id, { status: 'Arızalı', notes: 'Isıtıcı rezistansı kaçak yapıyor olabilir; röle atıyor.' });

  const kat = store.create('panels', {
    siteId: site.id,
    code: 'KGP-B3',
    name: 'B Blok 3. kat geçici panosu',
    type: 'Şantiye tali panosu (geçici)',
    location: 'B Blok, 3. kat, merdiven sahanlığı',
    status: 'Devrede',
    parentPanelId: sp.id,
    parentCircuitId: spCircuits[2].id,
    mainDevice: 'Yük ayırıcı 4P',
    mainRating: 63,
    mainRcdMa: 30,
    shortCircuitKa: 6,
    earthingSystem: 'TN-S',
    voltage: '400/230 V',
    ipClass: 'IP44',
    rows: 1,
    modulesPerRow: 18
  });
  const katC = add(kat, [
    ['F1', 'Kat aydınlatma (seyyar)', 'Aydınlatma', 'MCB (otomatik sigorta)', 'B', 16, '1P+N', 'L1', 'H07RN-F 1.5', 1.2],
    ['F2', 'Seyyar priz kutusu 1', 'Şantiye prizi / seyyar', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', 'L1', 'H07RN-F 2.5', 3],
    ['F3', 'Seyyar priz kutusu 2', 'Şantiye prizi / seyyar', 'MCB (otomatik sigorta)', 'C', 16, '1P+N', 'L2', 'H07RN-F 2.5', 3],
    ['F4', 'Karot / kırıcı prizi', 'Şantiye prizi / seyyar', 'MCB (otomatik sigorta)', 'C', 20, '1P+N', 'L2', 'H07RN-F 2.5', 2.5],
    ['F5', 'Sıva makinesi', 'Motor / pompa', 'MCB (otomatik sigorta)', 'D', 32, '3P+N', '3F', 'H07RN-F 6', 9]
  ]);
  store.update('circuits', katC[3].id, { status: 'Kilitli (LOTO)', lotoBy: 'Elektrikçi', lotoAt: new Date().toISOString(), notes: 'Priz kutusu kapağı kırık, değişim bekliyor.' });

  store.create('inspections', {
    siteId: site.id, panelId: sp.id, date: daysAgo(12), type: 'Kaçak akım rölesi testi', by: 'Elektrik sorumlusu',
    result: 'Uygun', rcdTripMs: 24, rcdTripMa: 22, earthOhm: 1.8, notes: 'Test butonu ve cihazla ölçüm yapıldı.'
  });
  store.create('inspections', {
    siteId: site.id, panelId: kat.id, date: daysAgo(41), type: 'Rutin görsel kontrol', by: 'Elektrikçi',
    result: 'Şartlı uygun', notes: 'Kablo girişinde rakor eksik.', nextActions: 'Rakor takılacak.'
  });
  store.create('inspections', {
    siteId: site.id, panelId: vinc.id, date: daysAgo(5), type: 'Termal kamera', by: 'Elektrik sorumlusu', result: 'Uygun', maxTempC: 46
  });

  store.create('events', {
    siteId: site.id, panelId: ofis.id, circuitId: ofisC[5].id, date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 16),
    type: 'Sigorta attı', by: 'Elektrikçi', description: 'Duş konteyneri: sabah 07:40 kaçak akım rölesi attı.'
  });
  store.create('events', {
    siteId: site.id, panelId: kat.id, circuitId: katC[3].id, date: new Date().toISOString().slice(0, 16),
    type: 'LOTO kilitleme', by: 'Elektrikçi', description: 'Priz kutusu hasarlı, devre kilitlendi ve etiketlendi.'
  });

  return { site, site2 };
}
