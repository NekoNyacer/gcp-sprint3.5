export function profileLevelPreview(isDemo: boolean) {
  return isDemo
    ? { level: 6, title: '城市綠旅人', currentXp: 680, nextLevelXp: 1000 }
    : { level: 1, title: '散步新芽', currentXp: 0, nextLevelXp: 100 };
}
