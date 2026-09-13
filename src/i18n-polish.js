(function(root){
  const entries=[
    ['项目与署名','Project and author','プロジェクトと作者'],
    ['GitHub 仓库 ↗','GitHub repository ↗','GitHub リポジトリ ↗']
  ];
  for(const [zh,en,ja] of entries)root.DuelUITranslations.messages[zh]={en,ja};
})(globalThis);
