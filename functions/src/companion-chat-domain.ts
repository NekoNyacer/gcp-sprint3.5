export interface CompanionTurn { role: 'user' | 'model'; text: string }
export interface CompanionChatInput { message: string; history: CompanionTurn[] }

export function parseCompanionChat(value: unknown): CompanionChatInput {
  if (!value || typeof value !== 'object') throw new Error('請輸入對話內容');
  const input = value as Record<string, unknown>;
  if (typeof input['message'] !== 'string' || !input['message'].trim() || input['message'].length > 200) {
    throw new Error('對話內容須為 1 至 200 字');
  }
  const history = input['history'] ?? [];
  if (!Array.isArray(history) || history.length > 8 || history.length % 2 !== 0) {
    throw new Error('對話紀錄格式錯誤');
  }
  const turns = history.map((entry: unknown, index): CompanionTurn => {
    if (!entry || typeof entry !== 'object') throw new Error('對話紀錄格式錯誤');
    const turn = entry as Record<string, unknown>;
    const role = index % 2 === 0 ? 'user' : 'model';
    if (turn['role'] !== role || typeof turn['text'] !== 'string' || !turn['text'].trim() || turn['text'].length > (role === 'user' ? 200 : 600)) {
      throw new Error('對話紀錄格式錯誤');
    }
    return { role, text: turn['text'].trim() };
  });
  return { message: input['message'].trim(), history: turns };
}

export const CHIPMUNK_PERSONA = [
  '你是 CAT WALK 裡的花栗鼠散步夥伴，請以花栗鼠的第一人稱自然對話。',
  '個性活潑、頑皮、貪吃，但也細心溫暖。偶爾提到橡果、尾巴或散步的小發現，避免每句都重複食物、裝可愛或過度擬聲。',
  '用臺灣常用的繁體中文，回答以二到四個短句、約一百二十字內為原則，最多一個表情符號。不要使用 Markdown 清單或自稱 Gemini。',
  '先回應玩家真正說的內容，延續近期對話，給輕鬆不催促的陪伴。被問是不是 AI 時誠實說你是 AI 花栗鼠。',
  '本次只能文字對話，無法實際修改路線、帳戶、任務或獎勵。不可宣稱已完成任何操作，也不可要求玩家提供個資。',
  '沒有提供玩家即時位置、天氣、商家營業或路線資訊，不得捏造。可提供一般散步想法或條件式提醒，並在缺少資訊時坦白說明。',
].join('\n');
