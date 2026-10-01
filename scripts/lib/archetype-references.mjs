import {parse} from 'acorn';

const scalarKeys=new Set(['series','nameIncludes','xyzNameIncludes','tunerNameIncludes','nonNameIncludes','ritualSeries','tunerFamily','tributeFamily','rankUpFamily']);
const listKeys=new Set(['nameIncludesAny','ritualSeriesAny']);
const literal=node=>node?.type==='Literal'&&typeof node.value==='string'?node.value:node?.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:null;
const key=node=>node?.name??node?.value;

// Parse JavaScript, never search quoted code/comment/regex bodies for fake
// references. Dynamic calls are resolved by their declared group tables and
// by the live material metadata checked in archetype-registry.test.cjs.
export function scanArchetypeReferences(source,file='fixture.js'){
  const references=[],directFamilies=[],substringRules=[];
  const add=(node,kind)=>{const name=literal(node);if(name)references.push({name,file,line:node.loc.start.line,kind});};
  function walk(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'){
      const name=node.callee.name??key(node.callee.property);
      if(['series','inArchetype','named'].includes(name))add(node.arguments[1],name);
      if(name==='arch')add(node.arguments[0],name);
      // Material archetype fields must not be fed to card-name string tests.
      // Testing the key itself (e.g. tunerNameIncludes.startsWith('Nordic'))
      // is distinct and remains valid.
      if(['includes','startsWith','endsWith','indexOf','match','search','test'].includes(name)&&node.arguments.some(n=>n.type==='MemberExpression'&&scalarKeys.has(key(n.property))))substringRules.push({file,line:node.loc.start.line});
    }
    if(node.type==='Property'){
      const name=key(node.key);
      if(scalarKeys.has(name)){add(node.value,name);if(node.value.type==='ArrayExpression')for(const e of node.value.elements)add(e,name);}
      if(listKeys.has(name)&&node.value.type==='ArrayExpression')for(const e of node.value.elements)add(e,name);
    }
    if(node.type==='VariableDeclarator'&&node.id.name==='groups'&&node.init?.type==='ObjectExpression'){
      for(const p of node.init.properties)if(p.value?.type==='ArrayExpression')add(p.value.elements[1],'groups');
    }
    if(node.type==='BinaryExpression'&&['===','!==','==','!='].includes(node.operator)&&[node.left,node.right].some(n=>n.type==='MemberExpression'&&key(n.property)==='family'))directFamilies.push({file,line:node.loc.start.line});
    for(const v of Object.values(node))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
  }
  walk(parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true}));
  return {references,directFamilies,substringRules};
}

export function materialArchetypeReferences(cards){
  const references=[];
  function visit(value,id,material=false){
    if(!value||typeof value!=='object')return;
    for(const [key,v] of Object.entries(value)){
      if(scalarKeys.has(key)||key==='family'&&material){if(typeof v==='string')references.push({name:v,file:'card:'+id,kind:key});}
      if(listKeys.has(key))for(const name of v||[])references.push({name,file:'card:'+id,kind:key});
      if(['fusion','fusionMore','synchro','link','earlyRules','materials'].includes(key))visit(v,id,true);
      else if(Array.isArray(value))visit(v,id,material);
    }
  }
  for(const c of cards)visit(c,c.id);
  return references;
}
