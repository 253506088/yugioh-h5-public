// SQLite stores the packed 64-bit value as a signed integer. Never round it
// through Number: the fourth setcode may require all 64 bits.
export function splitSetcodes(value) {
  let packed=BigInt.asUintN(64,BigInt(value||0));
  const codes=[];
  for(let i=0;i<4;i++,packed>>=16n){const code=Number(packed&0xffffn);if(code&&!codes.includes(code))codes.push(code);}
  return codes;
}

export function setcodeReader(db) {
  const query=db.prepare('SELECT id, setcode, alias FROM datas WHERE id=?');
  query.setReadBigInts(true);
  return id=>{
    const visited=new Set();let row=query.get(id),sourceId=id;
    if(!row)return null;
    while(row){
      visited.add(Number(row.id));
      const setcodes=splitSetcodes(row.setcode);
      if(setcodes.length||!row.alias||visited.has(Number(row.alias)))return {setcodes,setcodeSourceId:Number(sourceId)};
      const alias=query.get(row.alias);if(!alias)return {setcodes:[],setcodeSourceId:Number(sourceId)};
      sourceId=alias.id;row=alias;
    }
  };
}
