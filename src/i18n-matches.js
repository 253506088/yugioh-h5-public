(function(root){
 const ui=root.DuelUITranslations;
 const rows=[
 ['主卡组40—60张，额外与副卡组各最多15张，三个分区同名合计最多3张。','Main Deck: 40–60 cards; Extra and Side Decks: up to 15 each. Up to three copies of a name across all sections.','メイン40～60枚、エクストラとサイドは各15枚まで。同名カードは全区分合計で3枚までです。'],
 ['比赛记录不存在。','The game journal is unavailable.','対戦記録が見つかりません。'],
 ['副卡组','Side deck','サイドデッキ'],
 ['副卡组必须是卡牌列表。','The side deck must be a card list.','サイドデッキはカード一覧で指定してください。'],
 ['卡牌列表格式无效。','Invalid card list.','カード一覧の形式が無効です。'],
 ['换备必须保留报名时的全部卡片。','Side decking must preserve every registered card.','登録した全カードを保持してください。'],
 ['卡片选择已失效。','This card selection is no longer valid.','カード選択は無効になりました。'],
 ['卡片不能移入这个分区。','This card cannot enter that section.','この区分には移動できません。'],
 ['比赛设置无效。','Invalid match settings.','対戦設定が無効です。'],
 ['需要两副卡组。','Two decks are required.','デッキが2つ必要です。'],
 ['当前不能选择先后攻。','Turn order cannot be chosen now.','現在は先後攻を選択できません。'],
 ['本轮构筑已锁定或换备尚未开始。','The deck is locked or side decking has not started.','デッキは確定済み、またはサイド変更開始前です。'],
 ['双方尚未准备。','Both players must be ready.','両者の準備完了が必要です。'],
 ['比赛状态已更新，请重新同步。','The match has changed. Please synchronize again.','マッチが更新されました。再同期してください。'],
 ['本轮换备已经结束。','This side-decking round has ended.','今回のサイド変更は終了しました。'],
 ['本局已经更新。','A new game has started.','新しいデュエルが開始されました。'],
 ['赛制无效。','Invalid match format.','対戦形式が無効です。'],
 ['主卡组 / 额外卡组','Main / Extra deck','メイン / エクストラデッキ'],
 ['重做','Redo','やり直す'],['当前构筑','Current deck','現在のデッキ'],
 ['关闭预览','Close preview','プレビューを閉じる']
 ];
 for(const [zh,en,ja] of rows)ui.messages[zh]={en,ja};
 ui.patterns.push(['^副卡组最多15张，当前(\\d+)张。$','Side deck: maximum 15 cards; currently $1.','サイドデッキは15枚までです。現在$1枚。']);
})(globalThis);
