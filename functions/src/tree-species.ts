/** Botanical demo art directions, shared by the models and CMS growth atlas. */
export interface TreeAppearance {
  id: string;
  name: string;
  shade: string;
  leaf: string;
  sun: string;
  bark: string;
  barkLight: string;
  flower: string;
  flowerCenter: string;
  leafWidth: number;
  crownWidth: number;
  description: string;
}
export const TREE_APPEARANCES: TreeAppearance[] = [
  {
    id: "banyan",
    name: "榕樹",
    shade: "#245265",
    leaf: "#659345",
    sun: "#cadb74",
    bark: "#72634d",
    barkLight: "#b19a70",
    flower: "#e9ead4",
    flowerCenter: "#d8b85c",
    leafWidth: 0.48,
    crownWidth: 1,
    description: "青綠橢圓葉・暖褐樹幹・乳白花",
  },
  {
    id: "osmanthus",
    name: "桂花",
    shade: "#284d40",
    leaf: "#507b37",
    sun: "#a7bb59",
    bark: "#74634e",
    barkLight: "#a48c60",
    flower: "#ffc45e",
    flowerCenter: "#da8c32",
    leafWidth: 0.36,
    crownWidth: 0.88,
    description: "深綠窄葉・灰褐樹幹・金橙花",
  },
  {
    id: "cherry",
    name: "櫻花",
    shade: "#445e57",
    leaf: "#7ba762",
    sun: "#c9d995",
    bark: "#77504c",
    barkLight: "#ad7e70",
    flower: "#f2a8c8",
    flowerCenter: "#ffe5a2",
    leafWidth: 0.55,
    crownWidth: 1.06,
    description: "嫩綠葉・紅褐樹幹・粉紅花",
  },
  {
    id: "ginkgo",
    name: "銀杏",
    shade: "#807638",
    leaf: "#c7b64b",
    sun: "#f1df87",
    bark: "#766c58",
    barkLight: "#b3a486",
    flower: "#e9d68b",
    flowerCenter: "#ac8b3c",
    leafWidth: 0.9,
    crownWidth: 0.82,
    description: "金黃寬葉・灰褐樹幹・淡黃花",
  },
  {
    id: "sweetgum",
    name: "楓香",
    shade: "#7b4139",
    leaf: "#b9693f",
    sun: "#e4ad58",
    bark: "#65514a",
    barkLight: "#9b7761",
    flower: "#c9775d",
    flowerCenter: "#eed6a2",
    leafWidth: 0.72,
    crownWidth: 0.95,
    description: "橙紅葉・深褐樹幹・珊瑚花",
  },
  {
    id: "camphor",
    name: "樟樹",
    shade: "#254f4c",
    leaf: "#44856a",
    sun: "#98bf78",
    bark: "#655c4e",
    barkLight: "#a69572",
    flower: "#daecd0",
    flowerCenter: "#c4cb74",
    leafWidth: 0.4,
    crownWidth: 1.1,
    description: "翠綠長葉・灰褐樹幹・淡綠花",
  },
  {
    id: "persimmon",
    name: "柿子",
    shade: "#35574b",
    leaf: "#7c963e",
    sun: "#c9c66b",
    bark: "#714f39",
    barkLight: "#ae8453",
    flower: "#f2df9e",
    flowerCenter: "#ca963f",
    leafWidth: 0.68,
    crownWidth: 0.97,
    description: "橄欖寬葉・棕褐樹幹・奶油花",
  },
  {
    id: "cathay",
    name: "國泰小樹",
    shade: "#1d5753",
    leaf: "#419c66",
    sun: "#b3d777",
    bark: "#796346",
    barkLight: "#b29b66",
    flower: "#a9d8bd",
    flowerCenter: "#e5c765",
    leafWidth: 0.58,
    crownWidth: 1.02,
    description: "明綠葉・金褐樹幹・薄荷花",
  },
];
export function treeAppearance(species: string): TreeAppearance {
  return (
    TREE_APPEARANCES.find((p) => p.name === species) ?? TREE_APPEARANCES[0]
  );
}
