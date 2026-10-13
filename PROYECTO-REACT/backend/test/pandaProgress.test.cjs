const {test}=require('node:test');
const assert=require('node:assert/strict');
const {progress,peruDate}=require('../src/services/pandaProgress');
const now=new Date('2026-10-13T15:00:00Z');
const entries=(days)=>days.map(day=>({horaEntrada:`2026-10-${day} 08:00:00`}));
test('legacy compatibility calculation matches the server rules exactly',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../src/services/pandaProgress.js'),'utf8').replace(/\r\n/g,'\n');
 const client=fs.readFileSync(path.join(__dirname,'../../frontend/src/utils/pandaProgress.js'),'utf8').replace(/\r\n/g,'\n');
 assert.equal(client,server.replace('module.exports = { progress, peruDate };','export { progress, peruDate };'));
});
test('new account starts at zero',()=>{const d=progress([],{},[],now);assert.deepEqual([d.xp,d.racha,d.bambusDisponibles,d.nivel,d.etapaKey],[0,0,0,1,'bebe']);assert.equal(d.hasCheckedInToday,false);});
test('daily rewards ignore duplicates and future dates',()=>{const d=progress(entries(['12','12','13','14']),{},[],now);assert.equal(d.xp,50);assert.equal(d.bambusGanados,20);assert.equal(d.asistenciasMes,2);assert.equal(d.hasCheckedInToday,true);});
test('streak skips rest days and gives today time to check in',()=>{assert.equal(progress(entries(['08','09','12']),{diasObjetivo:[1,2,4,5]},[],now).racha,3);});
test('missed scheduled day breaks streak',()=>{assert.equal(progress(entries(['08','09']),{diasObjetivo:[1,2,4,5]},[],now).racha,0);});
test('dates use Lima at midnight',()=>{assert.equal(peruDate('2026-10-13T02:00:00Z'),'2026-10-12');assert.equal(peruDate('2026-10-13 00:10:00'),'2026-10-13');});
test('pending and delivered redemptions reduce balance',()=>{const d=progress(entries(['12','13']),{},[{costoBambus:5,estado:'pendiente'},{costoBambus:3,estado:'entregado'},{costoBambus:9,estado:'cancelado'}],now);assert.equal(d.bambusDisponibles,12);assert.equal(d.bambusCanjeados,8);});
test('levels continue above muscular stage',()=>{const d=progress(Array.from({length:60},(_,i)=>({horaEntrada:new Date(Date.UTC(2026,0,i+1,15))})),{},[],now);assert.equal(d.nivel,6);assert.equal(d.currentLevelBaseXp,1500);assert.equal(d.nextNivelXp,2000);});
test('canje uses catalog cost and commits stock and real code',async()=>{
 const db=require('../src/config/database'),original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql,args)=>{
  calls.push({sql,args});if(sql.startsWith('SELECT id FROM usuarios'))return [[{id:7}]];
  if(sql.startsWith('SELECT id, nombre'))return [[{id:3,nombre:'Premio',costo_bambus:10,stock:1}]];
  if(sql.startsWith('SELECT hora_entrada'))return [[{horaEntrada:'2026-01-01 08:00:00'},{horaEntrada:'2026-01-02 08:00:00'}]];
  if(sql.startsWith('SELECT costo_bambus'))return [[]];return [{insertId:22,affectedRows:1}];
 }});
 try{const r=await require('../src/models/AttendanceModel').redeemReward(7,{recompensaId:3,costoBambus:1});assert.equal(r.bambusRestantes,10);assert.equal(r.redemption.costoBambus,10);assert.equal(r.redemption.id,22);assert.ok(calls.some(c=>c.sql?.includes('stock=stock-1')));assert.ok(calls.includes('commit'));}finally{db.getConnection=original;}
});
test('unknown reward rolls back without a redemption',async()=>{
 const db=require('../src/config/database'),original=db.getConnection,calls=[];
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql)=>{calls.push(sql);return sql.startsWith('SELECT id FROM usuarios')?[[{id:7}]]:[[]];}});
 try{await assert.rejects(require('../src/models/AttendanceModel').redeemReward(7,{recompensaId:99}));assert.ok(calls.includes('rollback'));assert.ok(!calls.includes('commit'));assert.ok(!calls.some(c=>c.startsWith('INSERT')));}finally{db.getConnection=original;}
});
