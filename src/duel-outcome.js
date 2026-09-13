(function(root){
  'use strict';
  const labels={
    'lp-zero':['生命值归零','Life Points reached zero','ライフポイントが0'],
    'deck-out':['无牌可抽','No cards left to draw','ドローできるカードがない'],
    exodia:['特殊胜利 · 艾克佐迪亚','Special victory · Exodia','特殊勝利・エクゾディア'],
    special:['特殊胜利','Special victory','特殊勝利'],
    draw:['决斗平局','Draw','引き分け']
  };
  const index=language=>language==='en'?1:language==='ja'?2:0;
  function create(state,winner,reason='',details={}){
    const loser=winner===0?1:winner===1?0:null;
    let kind=details.kind;
    if(!kind){
      if(state.winKind==='exodia'||/艾克佐迪亚|Exodia/i.test(reason))kind='exodia';
      else if(/无法抽卡|无牌可抽|无法完成同时抽卡|no cards.*draw/i.test(reason))kind='deck-out';
      else if(loser!==null&&state.players[loser]?.lp<=0||/生命值.*归零/.test(reason))kind='lp-zero';
      else kind=winner==='draw'?'draw':'special';
    }
    return {kind,winner,loser,reason:String(reason||''),turn:state.turn,...details};
  }
  function read(state){return state?.winner===null||state?.winner===undefined?null:state.outcome||create(state,state.winner,state.resultReason);}
  function label(outcome,language='zh-CN'){return (labels[outcome?.kind]||labels.special)[index(language)];}
  function describe(outcome,{language='zh-CN',names=['你','对方'],cardName=()=>''}={}){
    if(!outcome)return '';
    const at=index(language),win=outcome.winner,lose=outcome.loser,winner=names[win],loser=names[lose];
    if(win==='draw')return [outcome.kind==='deck-out'?'双方都无牌可抽，本局平局。':outcome.kind==='lp-zero'?'双方生命值同时归零，本局平局。':outcome.reason||'双方在同一时刻迎来结局，本局平局。',outcome.kind==='deck-out'?'Neither player can draw. The duel is a draw.':outcome.kind==='lp-zero'?'Both players have zero Life Points. The duel is a draw.':'The duel ends in a draw.',outcome.kind==='deck-out'?'両プレイヤーがドローできず、引き分けです。':outcome.kind==='lp-zero'?'両者のLPが0になり、引き分けです。':'このデュエルは引き分けです。'][at];
    if(outcome.kind==='deck-out')return [`${loser}在需要抽卡时无牌可抽，${winner}获胜。`,`${loser} could not draw a required card. ${winner} wins.`,`${loser}が必要なドローを行えず、${winner}の勝利です。`][at];
    if(outcome.kind==='lp-zero')return [`${loser}的生命值归零，${winner}获胜。`,`${loser}'s Life Points reached zero. ${winner} wins.`,`${loser}のLPが0になり、${winner}の勝利です。`][at];
    if(outcome.kind==='exodia')return [`${winner}集齐艾克佐迪亚的五个不同部件，获得特殊胜利。`,`${winner} assembled all five different Exodia pieces and wins.`,`${winner}がエクゾディアの5種類のパーツを揃え、特殊勝利しました。`][at];
    const card=outcome.sourceId?cardName(outcome.sourceId):'';
    return [`${winner}达成${card?'「'+card+'」的':'卡片的'}特殊胜利条件。${outcome.reason}`,`${winner} wins by ${card?card+"'s":'a card’s'} special victory condition.`,`${winner}が${card?'「'+card+'」の':'カードの'}特殊勝利条件を満たしました。`][at];
  }
  function summary(outcome,options={}){return label(outcome,options.language)+'：'+describe(outcome,options);}
  const api={create,read,label,describe,summary};root.DuelOutcome=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
