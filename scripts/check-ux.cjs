#!/usr/bin/env node
/**
 * App-wide UX smoke audit. Looks at EVERY TSX screen, not just the screens
 * touched in a pull request. Helps prevent silent/dead controls creeping in.
 *
 * A native device run is still required for visual clipping, fonts, keyboard
 * insets, VoiceOver and API/network behaviour.
 */
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const excluded=new Set(['node_modules','.git','.expo','dist','build','coverage','web-build']);
const files=[];
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(excluded.has(e.name))continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(e.isFile()&&p.endsWith('.tsx'))files.push(p);
 }
}
walk(root);
let controls=0,errors=0;
const tags=new Set(['MotionPressable','Pressable','TouchableOpacity','TouchableHighlight','TouchableWithoutFeedback']);
for(const file of files){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function report(node,message){
  const loc=source.getLineAndCharacterOfPosition(node.getStart(source));
  console.error(path.relative(root,file)+':'+(loc.line+1)+':'+(loc.character+1)+' — '+message);
  errors++;
 }
 function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(source);
   if(tags.has(tag)){
    controls++;
    const attributes=node.attributes.properties.filter(ts.isJsxAttribute);
    const press=attributes.find(p=>p.name.text==='onPress');
    const disabled=attributes.find(p=>p.name.text==='disabled');
    const onLongPress=attributes.find(p=>p.name.text==='onLongPress');
    if(!press&&!disabled&&!onLongPress)report(node,tag+' is visible but has no action or disabled state');
    if(press&&press.initializer&&ts.isJsxExpression(press.initializer)){
     const expression=press.initializer.expression;
     if(expression&&ts.isArrowFunction(expression)&&ts.isBlock(expression.body)&&!expression.body.statements.length)
       report(node,'A visible control has an empty onPress handler');
    }
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
if(errors){
 console.error('UX audit failed: '+errors+' dead control(s) found across '+files.length+' screens.');
 process.exitCode=1;
}else{
 console.log('UX audit passed: '+controls+' clickable controls checked across '+files.length+' screens.');
}
