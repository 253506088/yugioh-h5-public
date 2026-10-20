(function(root){
const need=(condition,code,message)=>{if(!condition)throw Object.assign(Error(message),{code});};
function decode(frame,uid){need(typeof uid==='string'&&frame.refs.has(uid),'CARD','卡片或选项已经失效，请重新选择。');return frame.refs.get(uid);}
function decodePicks(frame,uids){need(Array.isArray(uids)&&uids.length<=256&&new Set(uids).size===uids.length,'CHOICE','选择列表无效。');return uids.map(uid=>decode(frame,uid));}
function decodeAction(engine,frame,seat,message){
    const input = message.action;
    need(input && typeof input === 'object' && !Array.isArray(input), 'ACTION', '操作格式无效。');
    need(input.owner === undefined || input.owner === seat, 'OWNER', '不能代替对手操作。');
    const pending = engine.state.pending;
    let action;
    if(input.type==='rule-action'){
      const candidate=frame.legal.find(a=>a.type==='rule-action'&&a.key===input.key);need(candidate,'ILLEGAL_ACTION','当前不能执行这个规则行动。');action={...candidate};
    } else if (pending) {
      need(['respond', 'pass', 'choose'].includes(input.type), 'CHOICE', '请先完成当前选择。');
      action = { type: input.type };
      if (input.type === 'respond') { action.uid = decode(frame, input.uid); if (typeof input.key === 'string') action.key = input.key; }
      if (input.type === 'choose') {
        if (input.cancel === true) action.cancel = true;
        else action.uids = decodePicks(frame, input.uids);
      }
    } else if (input.type === 'phase' || input.type === 'end') {
      action = { type: input.type };
      if (input.type === 'phase') { need(['battle', 'main2'].includes(input.phase), 'PHASE', '不能进入这个阶段。'); action.phase = input.phase; }
    } else {
      const uid = input.uid ? decode(frame, input.uid) : undefined;
      const candidate = frame.legal.find(a => a.type === input.type && a.uid === uid && a.key === input.key && a.mode === input.mode && a.slot === input.slot && !!a.noTribute === !!input.noTribute && !!a.bloodPact === !!input.bloodPact);
      need(candidate, 'ILLEGAL_ACTION', '这张卡当前不能进行这个操作。');
      action = { ...candidate };
      if (input.type === 'attack') action.target = input.target == null ? null : decode(frame, input.target);
    }
    if (input.position !== undefined) { need(['attack', 'defense'].includes(input.position), 'POSITION', '表示形式无效。'); action.position = input.position; }
    if (input.zone !== undefined) { need([0, 1, 2, 3, 4, 'extra', 'extra2'].includes(input.zone), 'ZONE', '召唤区域无效。'); action.zone = input.zone; }
    // All other caller fields (choices, no-cost flags, RNG, state, materials…) are ignored.
    action.owner = seat;

return action;
}
root.DuelIntent={decodeAction,decodePicks};if(typeof module!=='undefined')module.exports=root.DuelIntent;
})(globalThis);
