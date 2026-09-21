(function(root){
  const entries=[
    ['项目与署名','Project and author','プロジェクトと作者'],
    ['GitHub 仓库 ↗','GitHub repository ↗','GitHub リポジトリ ↗'],
    ['我的卡组','My deck','自分のデッキ'],
    ['搜索我的卡组','Search my decks','自分のデッキを検索'],
    ['搜索对手卡组','Search opponent decks','相手のデッキを検索'],
    ['名称、年份或卡名…','Name, year or card…','デッキ名・年・カード名…'],
    ['清空搜索','Clear search','検索をクリア'],
    ['清除筛选','Clear filters','絞り込みをクリア'],
    ['没有匹配的卡组','No matching decks','一致するデッキがありません'],
    ['试试其他关键词，或清除筛选。','Try another keyword or clear the filters.','別のキーワードを試すか、絞り込みを解除してください。'],
    ['没有匹配的卡组，当前选择已保留。','No matches. Your selected deck is kept.','一致するデッキがありません。選択中のデッキは保持されます。'],
    ['当前选择','Current selection','現在の選択'],
    ['搜索结果','Search results','検索結果'],
    ['我方卡片','Your cards','自分のカード'],
    ['对方卡片','Opponent cards','相手のカード'],
    ['场地区','Field Zone','フィールドゾーン'],
    ['选择效果连锁，或跳过本次响应。','Choose an effect to chain, or pass this response.','チェーンする効果を選ぶか、今回は発動せずに進めます。']
  ];
  for(const [zh,en,ja] of entries)root.DuelUITranslations.messages[zh]={en,ja};
})(globalThis);
