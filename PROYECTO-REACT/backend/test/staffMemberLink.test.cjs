const {test}=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const links=require('../src/services/staffMemberLink');
const access=require('../src/services/roleAccess');
const actor={id:1,rol:'admin',permissions:access.KEYS};
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});

function database(t) {
    const original={execute:db.execute,getConnection:db.getConnection};
    t.after(()=>Object.assign(db,original));
    const people=new Map([[1,{id:1,rol:'admin',activo:1}],[2,{id:2,rol:'recepcion',activo:1}],[42,{id:42,rol:'cliente',activo:1}],[43,{id:43,rol:'cliente',activo:0}]]);
    const mapping=new Map(),calls=[];
    let snapshot;
    const execute=async(sql,args=[])=>{
        calls.push({sql,args});
        if(sql.includes('FROM staff_member_links l JOIN usuarios m')) {
            const member=people.get(mapping.get(Number(args[0])));return [member?[member]:[]];
        }
        if(sql.includes('SELECT u.id,u.activo,r.nombre AS rol'))return [people.has(args[0])?[people.get(args[0])]:[]];
        if(sql.startsWith('SELECT staff_user_id')&&sql.includes('member_user_id=?')) {
            const found=[...mapping].find(([,member])=>member===args[0]);return [found?[{staff_user_id:found[0]}]:[]];
        }
        if(sql.startsWith('SELECT staff_user_id'))return [mapping.has(args[0])?[{staff_user_id:args[0]}]:[]];
        if(sql.startsWith('INSERT INTO staff_member_links')) {
            if([...mapping.values()].includes(args[1]))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});
            mapping.set(args[0],args[1]);return [{affectedRows:1}];
        }
        if(sql.startsWith('UPDATE staff_member_links')) {
            if([...mapping].some(([staff,member])=>staff!==args[2]&&member===args[0]))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});
            mapping.set(args[2],args[0]);return [{affectedRows:1}];
        }
        if(sql.startsWith('DELETE FROM staff_member_links')){mapping.delete(args[0]);return [{affectedRows:1}];}
        throw Error(`Unexpected SQL: ${sql}`);
    };
    db.execute=execute;
    db.getConnection=async()=>({execute,beginTransaction:async()=>{snapshot=new Map(mapping);},commit:async()=>{},rollback:async()=>{mapping.clear();for(const item of snapshot)mapping.set(...item);},release(){}});
    return {people,mapping,calls};
}

test('staff can activate the same account without creating a second DNI, changing roles, or adding points',async t=>{
    const {mapping,people,calls}=database(t);
    await links.save(actor,1,1);
    assert.equal(mapping.get(1),1);assert.equal(people.get(1).rol,'admin');
    assert.equal(await links.getMemberId(actor),1);
    assert.ok(calls.every(({sql})=>!sql.match(/(?:INSERT INTO|UPDATE) (?:usuarios|asistencias|membresias|canjes_recompensas)/)));
    assert.deepEqual(links.fromRow({id:1,memberId:1,memberDni:'00000000',memberNombre:'Admin',memberApellido:'Prueba',memberActivo:1}),{id:1,dni:'00000000',nombre:'Admin',apellido:'Prueba',activo:true,sameAccount:true});
});

test('existing member link is optional, unique, and unlinking does not erase training history',async t=>{
    const {mapping,calls}=database(t);
    await assert.rejects(links.getMemberId(actor),e=>e.code==='MEMBER_NOT_LINKED');
    await links.save(actor,1,42);assert.equal(await links.getMemberId(actor),42);
    await assert.rejects(links.save(actor,2,42),e=>e.code==='ER_DUP_ENTRY');
    assert.equal(mapping.get(1),42);assert.equal(mapping.has(2),false);
    await links.save(actor,1,null);assert.equal(mapping.has(1),false);
    await assert.rejects(links.getMemberId({...actor,memberLink:{id:42,activo:true}}),e=>e.code==='MEMBER_NOT_LINKED');
    assert.ok(calls.filter(({sql})=>sql.startsWith('DELETE')).every(({sql})=>sql.startsWith('DELETE FROM staff_member_links')));
    await links.save(actor,2,42);assert.equal(mapping.get(2),42);
});

test('cannot link another staff account, an inactive member, or manage administrator profiles without authorization',async t=>{
    database(t);
    await assert.rejects(links.save(actor,1,2),/Solo puedes vincular/);
    await assert.rejects(links.save(actor,1,43),/Activa la cuenta/);
    await assert.rejects(links.save(actor,42,42),/cuenta del personal/);
    await assert.rejects(links.save({id:2,rol:'cliente',permissions:access.KEYS},2,42),e=>e.status===403);
    await assert.rejects(links.save({id:2,rol:'recepcion',permissions:['usuarios']},2,42),e=>e.status===403);
    await assert.rejects(links.save({id:2,rol:'recepcion',permissions:['usuarios','socios']},1,42),e=>e.status===403);
    for(const value of [0,-1,NaN,1.5])await assert.rejects(links.save(actor,1,value),/válidos/);
});

test('deactivating a linked member blocks training, while clients continue to use their own identity',async t=>{
    const {people}=database(t);await links.save(actor,1,42);
    people.get(42).activo=0;
    await assert.rejects(links.getMemberId(actor),e=>e.code==='MEMBER_INACTIVE');
    const res=response();await links.requireMember({auth:actor},res,()=>{throw Error('inactive was allowed');});
    assert.equal(res.statusCode,409);assert.equal(res.body.code,'MEMBER_INACTIVE');
    assert.equal(await links.getMemberId({id:7,rol:'cliente',memberLink:{id:999}}),7);
    people.get(42).activo=1;assert.equal(await links.getMemberId(actor),42);
});

test('linked workers get personal endpoints, without access to staff management or reward mutations',async()=>{
    const worker={id:2,rol:'entrenador',permissions:['inicio'],memberLink:{id:42,activo:true}};
    for(const url of ['/api/asistencias/pandita-estado','/api/asistencias/mi-historial','/api/membresias/mi-membresia','/api/recompensas/catalogo','/api/recompensas/mis-canjes'])assert.equal(access.canRequest(worker,{originalUrl:url,method:'GET'}),true);
    assert.equal(access.canRequest(worker,{originalUrl:'/api/asistencias/mi-objetivo',method:'PUT'}),true);
    assert.equal(access.canRequest(worker,{originalUrl:'/api/asistencias/canjear-recompensa',method:'POST'}),true);
    for(const [method,url] of [['GET','/api/admin/usuarios'],['GET','/api/admin/socios'],['GET','/api/recompensas/admin/canjes-todos'],['POST','/api/recompensas/catalogo'],['PUT','/api/recompensas/catalogo/1'],['DELETE','/api/recompensas/catalogo/1']])assert.equal(access.canRequest(worker,{originalUrl:url,method}),false);
    const {canAccess,staffSections,withPersonalTraining}=await import('../../frontend/src/utils/access.js');
    assert.equal(canAccess(worker,'mi-pandita'),true);assert.equal(canAccess(worker,'mis-recompensas'),true);assert.equal(canAccess(worker,'usuarios'),false);
    const items=staffSections(worker).flatMap(section=>section.items).map(item=>item.to);
    for(const url of ['/app/mi-pandita','/app/asistencias','/app/mi-membresia','/app/mis-recompensas'])assert.ok(items.includes(url));
    assert.equal(items.length,new Set(items).size);
    const client=[{category:'Original',items:[]}];assert.equal(withPersonalTraining({rol:'cliente'},client),client);
});

test('calendar, goals, membership, payments and redemption use only the linked member, ignoring submitted IDs',async t=>{
    const {mapping}=database(t);mapping.set(1,42);
    const attendance=require('../src/models/AttendanceModel'),membership=require('../src/models/MembershipModel');
    const attendanceController=require('../src/controllers/AttendanceController'),membershipController=require('../src/controllers/MembershipController');
    const calls=[];
    const originals={};
    for(const [object,names] of [[attendance,['getByUser','getUserGoals','getUserRedemptions','updateUserGoals','getAttendanceCountByUser','redeemReward']],[membership,['getClientMembership','getPaymentHistory']]])for(const name of names){
        originals[name]=object[name];t.after(()=>{object[name]=originals[name];});
        object[name]=async(id,body)=>{calls.push({name,id,body});
            if(name==='getUserGoals')return {diasObjetivo:[1,2,3,4,5,6],horarioPreferido:'Acceso Libre'};
            if(name==='getAttendanceCountByUser')return 0;
            if(name==='getClientMembership')return null;
            if(name==='redeemReward')return {codigoCanje:'ACTUAL',costoBambus:10};
            return [];
        };
    }
    const req={auth:actor,body:{diasObjetivo:[1,3,5],recompensaId:5,userId:999,usuarioId:999},query:{userId:999}};
    const gate=response();let allowed=false;await links.requireMember(req,gate,()=>{allowed=true;});assert.equal(allowed,true);assert.equal(req.memberId,42);
    for(const handler of [attendanceController.getMyAttendanceHistory,attendanceController.getPandaStatus,attendanceController.getUserAttendanceSummary,attendanceController.updateMyGoals,attendanceController.redeemReward,membershipController.getMyMembership,membershipController.getMyPayments]){
        const res=response();await handler(req,res);assert.equal(res.statusCode,200);
        if(handler===attendanceController.getPandaStatus){assert.equal(res.body.xp,0);assert.equal(res.body.nivel,1);}
    }
    assert.ok(calls.length>=10);assert.ok(calls.every(call=>call.id===42));
    assert.equal(req.auth.id,1);assert.equal(req.auth.rol,'admin');
});

test('failed concurrent unique insert rolls back rather than transferring an existing member',async t=>{
    const {mapping}=database(t);const original=db.getConnection;
    db.getConnection=async()=>{
        const connection=await original();const execute=connection.execute;
        connection.execute=async(sql,args)=>{if(sql.startsWith('INSERT INTO staff_member_links'))throw Object.assign(new Error('concurrent duplicate'),{code:'ER_DUP_ENTRY'});return execute(sql,args);};
        return connection;
    };
    await assert.rejects(links.save(actor,1,42),e=>e.code==='ER_DUP_ENTRY');
    assert.equal(mapping.size,0);
});
