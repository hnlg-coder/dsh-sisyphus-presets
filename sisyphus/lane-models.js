/**
 * lane-models.js - 杞﹂亾妯″瀷闆嗕腑閰嶇疆(闅?preset 鐩綍鏃呰)
 *
 * 姣忎釜杞﹂亾:null / undefined / 鐪佺暐 = 缁ф壙浼氳瘽妯″瀷(榛樿,闆堕厤缃?
 *          { provider, model } = 鍥哄畾璇ヨ溅閬撴ā鍨? * provider 蹇呴』鏄綘鐨?settings.yaml 鈫?llm-pi-ai.providers 閲岀殑 key銆? *
 * 绀轰緥:
 *   oracle: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
 *   vision: { provider: 'opencode-go', model: 'mimo-v2.5' },  // read_image 闇€澶氭ā鎬? *
 * 淇敼鍚庨噸鍚?DSH(鎴栨柊寮€浼氳瘽)鐢熸晥銆傛鏂囦欢涓?agent.cordis.yml 涓€璧疯
 * loader 鍦ㄦ寕杞芥椂璇诲彇,鍥犳杞﹂亾閰嶇疆涓?preset 缁撴瀯瑙ｈ€︺€? */
module.exports = {
  explore: null,
  oracle: null,
  vision: null,
  librarian: null,
  metis: null,
  momus: null,
};
