/** Demo catalog districts. Unknown places still require an explicit postal code. */
export const TREE_REGIONS: Readonly<Record<string, string>> = {
  '114': '台北市內湖區',
  '220': '新北市板橋區',
  '100': '台北市中正區',
  '103': '台北市大同區',
  '104': '台北市中山區',
  '105': '台北市松山區',
  '106': '台北市大安區',
  '108': '台北市萬華區',
  '110': '台北市信義區',
  '111': '台北市士林區',
  '112': '台北市北投區',
  '115': '台北市南港區',
  '116': '台北市文山區',
};

export function legacyTreePostalCode(place: string): string | undefined {
  if (['西湖', '內湖', '港墘'].includes(place)) return '114';
  if (['板橋車站', '萬坪公園', '府中', '市民廣場', '新板', '435 藝文特區', '萬坪公園步道', '新北市民廣場步道', '新板公共步道'].includes(place)) return '220';
  return undefined;
}
