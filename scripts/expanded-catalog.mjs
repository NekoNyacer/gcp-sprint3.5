// Demo station coordinates describe the landmark's surrounding walking area,
// never a verified branch entrance or proof of a commercial partnership.
// District-area coordinates are approximate demo anchors, not verified entrances.
export const districtDemoAreas = [
  ['banqiao', '新北市板橋區', '220', 25.0010, 121.4548],
  ['zhongzheng', '臺北市中正區', '100', 25.0325, 121.5196],
  ['datong', '臺北市大同區', '103', 25.0620, 121.5100],
  ['zhongshan', '臺北市中山區', '104', 25.0640, 121.5260],
  ['songshan', '臺北市松山區', '105', 25.0500, 121.5570],
  ['daan', '臺北市大安區', '106', 25.0260, 121.5430],
  ['wanhua', '臺北市萬華區', '108', 25.0296, 121.4998],
  ['xinyi', '臺北市信義區', '110', 25.0335, 121.5650],
  ['shilin', '臺北市士林區', '111', 25.0937, 121.5269],
  ['beitou', '臺北市北投區', '112', 25.1321, 121.4986],
  ['neihu', '臺北市內湖區', '114', 25.0820, 121.5720],
  ['nangang', '臺北市南港區', '115', 25.0520, 121.6070],
  ['wenshan', '臺北市文山區', '116', 24.9980, 121.5540],
];
export const plantingCandidates = [
  ['neihu-bihu', '碧湖公園', '114', 25.0846, 121.5825],
  ['neihu-dahu', '大湖公園', '114', 25.0836, 121.6025],
  ['neihu-lohas', '樂活公園', '114', 25.0739, 121.6157],
  ['neihu-dagou', '大溝溪生態治水園區', '114', 25.0937, 121.6020],
  ['neihu-huzhou', '葫洲站周邊步行區', '114', 25.0726, 121.6071],
  ['neihu-zhouzi', '洲子公園', '114', 25.0790, 121.5727],
  ['neihu-ruiguang', '瑞光公園', '114', 25.0735, 121.5737],
  ['neihu-xinhu', '新湖公園', '114', 25.0629, 121.5852],
  ['neihu-kangle', '康樂綠地', '114', 25.0800, 121.6195],
  ['banqiao-wanping', '新板萬坪都會公園', '220', 25.0147, 121.4600],
  ['banqiao-lin', '林本源園邸外圍步行區', '220', 25.0103, 121.4542],
  ['banqiao-435', '板橋435藝文特區', '220', 25.0237, 121.4511],
  ['banqiao-musical', '板橋音樂公園', '220', 25.0280, 121.4835],
  ['banqiao-fuzhou', '浮洲運動公園', '220', 24.9990, 121.4438],
  ['banqiao-xikun', '溪崑公園', '220', 24.9869, 121.4270],
  ['banqiao-zhongshan', '中山公園', '220', 25.0103, 121.4751],
  ['banqiao-guangfu', '光復賞鳥綠地', '220', 25.0261, 121.4932],
  ['banqiao-houpu', '後埔步行區', '220', 25.0016, 121.4637],
  ...districtDemoAreas.flatMap(([id, district, postalCode, latitude, longitude]) => [
    [`${id}-demo-west`, `${district}西側展示種植區`, postalCode, latitude, longitude - 0.006],
    [`${id}-demo-east`, `${district}東側展示種植區`, postalCode, latitude + 0.006, longitude + 0.006],
  ]),
];
export function distance(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((a.latitude-b.latitude)*r/2)**2 + Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((a.longitude-b.longitude)*r/2)**2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function expandCatalog(seed) {
  seed.seedTypes = [
    seed.seedTypes?.[0] ?? {id: 'mystery', name: '神秘種子', enabled: true, outcomes: [{species: '榕樹', weight: 60}, {species: '桂花', weight: 30}, {species: '櫻花', weight: 9}, {species: '銀杏', weight: 1}]},
    {id: 'woodland', name: '森林種子', enabled: true, outcomes: [{species: '樟樹', weight: 70}, {species: '楓香', weight: 25}, {species: '銀杏', weight: 5}]},
    {id: 'blossom', name: '花園種子', enabled: true, outcomes: [{species: '桂花', weight: 75}, {species: '柿子', weight: 20}, {species: '櫻花', weight: 5}]},
  ];
  const sourceUrl = 'https://www.cathay-cube.com.tw/cathaybk/personal/product/credit-card/cards/cube-list';
  seed.cubeChannels = ['7-ELEVEN', '全家便利商店', '全聯福利中心', 'LOPIA台灣', 'IKEA宜家家居'].map((brand, i) => ({
    id: `cube-curated-${i}`, name: `${brand} 國內通路`, brand, plan: '集精選',
    startsOn: '2026-01-01', endsOn: '2026-12-31', domestic: true, enabled: true, sourceUrl,
    terms: '依官方指定通路及實際簽單、支付方式認定；不保證個別交易回饋。全聯不含大全聯，排除菸品、代收代售及禮券等。資料核對日：2026-10-22。',
  }));
  // Keep the user's plan selectable without inventing Taiwan UNIQLO eligibility.
  seed.cubeChannels.push({id: 'cube-autumn-reference', name: '秋日遊（國內適用通路待確認）', brand: '待確認', plan: '秋日遊', startsOn: '2026-10-01', endsOn: '2026-11-30', domestic: true, enabled: true, sourceUrl,
    terms: '官方 UNIQLO 指定為日本實體通路；目前沒有將台灣 UNIQLO 門市列入此方案。此參考設定未連結任何商家。'});
  for (const [id, place, postalCode, latitude, longitude] of plantingCandidates) {
    const site = {id: `planting-${id}`, name: `${place}種樹點`, place, postalCode, latitude, longitude, species: '', empty: true, growth: 0, weather: 'sunny', timeOfDay: 'day'};
    // 450 m is an editable seed-generation default, not a confirmed product rule.
    if (seed.trees.every(t => distance(t, site) >= 450)) seed.trees.push(site);
  }
  seed.trees = seed.trees.map(t => t.empty ? {...t, species: ''} : t);
  const stores = [
    ['family-lishui', '全家麗水店', '臺北市內湖區內湖路一段733號', 25.0798, 121.5786],
    ['family-yanghu', '全家陽湖店', '臺北市內湖區內湖路一段91巷4號', 25.0860, 121.5593],
    ['family-wenhu', '全家文湖店', '臺北市內湖區文湖街59號', 25.0871, 121.5609],
    ['family-ziyang', '全家紫陽店', '臺北市內湖區文德路212號', 25.0788, 121.5878],
    ['family-minshan', '全家民善店', '臺北市內湖區民善街1號', 25.0614, 121.5749],
    ['family-dehu', '全家德湖店', '臺北市內湖區成功路四段62號', 25.0823, 121.5921],
    ['family-kangyun', '全家康雲店', '臺北市內湖區康寧路一段116號', 25.0794, 121.5933],
    ['family-dongmao', '全家東茂店', '臺北市內湖區康寧路三段189巷12號', 25.0684, 121.6118],
    ['family-kangfu', '全家康福店', '臺北市內湖區康樂街87號', 25.0693, 121.6188],
    ['family-ruihu', '全家瑞湖店', '臺北市內湖區瑞光路513巷39號', 25.0809, 121.5685],
    ['family-fushan', '全家板橋富山店', '新北市板橋區三民路一段94號', 25.0203, 121.4788],
    ['family-tianhe', '全家板橋天和店', '新北市板橋區三民路二段140號', 25.0131, 121.4792],
    ['family-daren', '全家板橋大仁店', '新北市板橋區大仁街108之1號', 25.0176, 121.4554],
    ['family-dayong', '全家板橋大勇店', '新北市板橋區大仁街36號', 25.0168, 121.4572],
    ['family-xinguang', '全家板橋新光店', '新北市板橋區中山路一段141之2號', 25.0102, 121.4627],
    ['family-dating', '全家板橋大庭店', '新北市板橋區中正路191號', 25.0168, 121.4551],
    ['family-wenhua', '全家板橋文化店', '新北市板橋區文化路一段280號', 25.0202, 121.4669],
    ['family-xinpu', '全家板橋新埔店', '新北市板橋區文化路一段421巷4號', 25.0231, 121.4687],
    ['family-hucui', '全家板橋宏翠店', '新北市板橋區四維路100號', 25.0263, 121.4640],
    ['family-jincheng', '全家板橋金成店', '新北市板橋區金門街313號', 24.9837, 121.4295],
  ];
  const addStore = (id, name, address, latitude, longitude, cubeChannelIds, locationSourceUrl) => seed.merchants.push({
    id, name, address, latitude, longitude, postalCode: address.includes('內湖區') ? '114' : '220', locationSourceUrl,
    category: '購物', twqr: false, enabled: true, roles: ['supply'], cubeChannelIds,
    offer: '散步補給體驗', terms: '真實商家名稱與地址；座標為地址周邊展示定位，入口尚待現勘。遊戲補給為模擬，非真實商家活動或 TWQR 合作承諾。',
    validUntil: '2026-12-31', resource: 'water', amount: 10, weather: 'sunny', timeOfDay: 'day',
  });
  for (const row of stores) addStore(...row, ['cube-curated-1'], 'https://nevent.family.com.tw/cloudprintSTORELIST/');
  addStore('ikea-neihu', 'IKEA 內湖店', '臺北市內湖區舊宗路一段128號', 25.0601, 121.5775, ['cube-curated-4'], 'https://www.ikea.com.tw/zh/store/nei-hu/info');
  addStore('uniqlo-banqiao', 'UNIQLO 板橋大遠百店', '新北市板橋區新站路28號3樓', 25.0143, 121.4673, [], 'https://www.uniqlo.com/tw/zh_TW/stores.html');
  const storeTypes = [
    ['cafe', '散步咖啡館', '美食', '室內休息、冷熱飲補給', '展示營業時段 08:00–21:00', -0.001, -0.001],
    ['convenience', '日夜便利補給', '購物', '飲水、雨具及隨行補給', '展示營業時段 24 小時', 0.002, 0.002],
    ['meal', '暖心食堂', '美食', '午餐與晚餐補給', '展示營業時段 11:00–14:00、17:00–21:00', -0.003, 0.004],
    ['bakery', '早晨烘焙坊', '美食', '早餐、點心與飲水補給', '展示營業時段 06:00–19:00', 0.004, -0.003],
    ['outdoor', '綠行補給屋', '購物', '步行裝備、遮陽及雨具補給', '展示營業時段 10:00–22:00', 0.006, 0.005],
  ];
  for (const [districtId, district, postalCode, latitude, longitude] of districtDemoAreas) {
    for (const [type, label, category, offer, hours, dLat, dLng] of storeTypes) {
      const id = `demo-${districtId}-${type}`;
      if (seed.merchants.some(m => m.id === id)) continue;
      seed.merchants.push({id, name: `${district.replace('臺北市', '').replace('新北市', '')}${label}（模擬）`,
        address: `${district}展示區・模擬位置（非真實商家）`, postalCode,
        latitude: latitude + dLat, longitude: longitude + dLng,
        category, twqr: false, enabled: true, roles: ['supply'], cubeChannelIds: [],
        offer: `Demo 模擬優惠：${offer}`,
        terms: `虛構展示商家與優惠，非真實商家活動或 TWQR 合作。${hours}（模擬）。入口與步行可達性未經現勘。`,
        validUntil: '2026-12-31', resource: 'water', amount: 10, weather: 'cloudy', timeOfDay: 'day'});
    }
  }
  return seed;
}
