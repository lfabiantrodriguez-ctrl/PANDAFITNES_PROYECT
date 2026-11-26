const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/config/database");
const OfferService = require("../src/services/offerService");
const NotificationService = require("../src/services/notificationService");
const MembershipController = require("../src/controllers/MembershipController");
const MembershipModel = require("../src/models/MembershipModel");
const PlanModel = require("../src/models/PlanModel");
const access = require("../src/services/roleAccess");

function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
    };
}

test("OfferService computes percentage, fixed, and free days benefits accurately", () => {
    assert.deepEqual(
        OfferService.computeBenefit({ tipo: "descuento_porcentaje", valor: 25 }, 200),
        { montoBase: 200, descuentoAplicado: 50, diasExtra: 0, montoFinal: 150 },
    );
    assert.deepEqual(
        OfferService.computeBenefit({ tipo: "descuento_fijo", valor: 100 }, 80),
        { montoBase: 80, descuentoAplicado: 80, diasExtra: 0, montoFinal: 0 },
    );
    assert.deepEqual(
        OfferService.computeBenefit({ tipo: "dias_gratis", valor: 7 }, 80),
        { montoBase: 80, descuentoAplicado: 0, diasExtra: 7, montoFinal: 80 },
    );
});

test("OfferService enforces limited cupos, single use per member, and context separation", async (t) => {
    const originalExecute = db.execute;
    t.after(() => {
        db.execute = originalExecute;
    });

    const offers = [
        {
            id: 1,
            usuarioId: null,
            titulo: "Promo 2 cupos",
            descripcion: "20% OFF",
            tipo: "descuento_porcentaje",
            valor: 20,
            codigoCupon: "PANDA20",
            fechaInicio: new Date("2026-01-01"),
            fechaFin: new Date("2028-01-01"),
            estado: "activo",
            cuposMaximos: 2,
            cuposUsados: 1,
        },
        {
            id: 2,
            usuarioId: 10,
            titulo: "Pase Amigo",
            descripcion: "1 invitado",
            tipo: "pase_amigo",
            valor: 1,
            codigoCupon: "AMIGO10",
            fechaInicio: new Date("2026-01-01"),
            fechaFin: new Date("2028-01-01"),
            estado: "activo",
            cuposMaximos: 1,
            cuposUsados: 0,
        },
    ];
    const uses = new Set(["1:5"]); // oferta 1 already used by user 5

    db.execute = async (sql, args = []) => {
        if (sql.includes("FROM ofertas_socios") && sql.includes("UPPER(TRIM(codigo_cupon))")) {
            const found = offers.find((o) => o.codigoCupon === args[0]);
            return [found ? [found] : []];
        }
        if (sql.includes("FROM ofertas_usos")) {
            return [uses.has(`${args[0]}:${args[1]}`) ? [{ id: 99 }] : []];
        }
        if (sql.includes("FROM solicitudes_renovacion")) {
            return [[]];
        }
        return [[]];
    };

    // User 8 can apply general promo with remaining cupo
    const ok = await OfferService.validateOfferCode({
        code: "panda20",
        userId: 8,
        planPrecio: 150,
        context: "renovacion",
    });
    assert.equal(ok.montoFinal, 120);
    assert.equal(ok.descuentoAplicado, 30);

    // User 5 cannot reuse the same promo
    await assert.rejects(
        OfferService.validateOfferCode({ code: "PANDA20", userId: 5, planPrecio: 150, context: "renovacion" }),
        /Ya utilizaste/,
    );

    // Exhausted promo is rejected
    offers[0].cuposUsados = 2;
    await assert.rejects(
        OfferService.validateOfferCode({ code: "PANDA20", userId: 9, planPrecio: 150, context: "renovacion" }),
        /límite máximo de cupos/,
    );

    // Pase Amigo cannot be used in renewal context, only in pase_amigo context
    await assert.rejects(
        OfferService.validateOfferCode({ code: "AMIGO10", userId: 10, planPrecio: 80, context: "renovacion" }),
        /Pase Libre para Amigo/,
    );
    const friendPassOk = await OfferService.validateOfferCode({
        code: "AMIGO10",
        userId: 10,
        planPrecio: 0,
        context: "pase_amigo",
    });
    assert.equal(friendPassOk.oferta.id, 2);
});

test("roleAccess permits authenticated notifications and linked member renewal routes", () => {
    const client = { id: 12, rol: "cliente", permissions: ["inicio", "mi-membresia"] };
    const linkedTrainer = {
        id: 5,
        rol: "entrenador",
        permissions: ["inicio"],
        memberLink: { id: 12, activo: true },
    };

    assert.equal(access.canRequest(client, { originalUrl: "/api/notificaciones", method: "GET" }), true);
    assert.equal(access.canRequest(linkedTrainer, { originalUrl: "/api/notificaciones/leer-todas", method: "PUT" }), true);
    assert.equal(access.canRequest(linkedTrainer, { originalUrl: "/api/membresias/mi-resumen", method: "GET" }), true);
    assert.equal(access.canRequest(linkedTrainer, { originalUrl: "/api/membresias/solicitar-renovacion", method: "POST" }), true);
    assert.equal(access.canRequest(linkedTrainer, { originalUrl: "/api/membresias/admin/solicitudes", method: "GET" }), false);
});

test("NotificationService filters admin vs client notifications properly", () => {
    const adminCond = NotificationService.buildAccessConditions({
        id: 1,
        rol: "admin",
        permissions: access.KEYS,
        memberLink: null,
    });
    assert.ok(adminCond.clauses.includes("(n.rol_destino = 'admin')"));
    assert.equal(adminCond.memberId, null);

    const clientCond = NotificationService.buildAccessConditions({
        id: 22,
        rol: "cliente",
        permissions: ["mi-membresia"],
        memberLink: null,
    });
    assert.equal(clientCond.memberId, 22);
    assert.equal(clientCond.clauses.some((c) => c.includes("rol_destino = 'admin'")), false);
});

test("MembershipController.requestRenewal validates digital proof requirement and creates admin notification", async (t) => {
    const origGetReg = MembershipModel.getMemberRegistrationInfo;
    const origCreateReq = MembershipModel.createRenewalRequest;
    const origNotifCreate = NotificationService.create;
    const origPlanFind = PlanModel.findById;
    t.after(() => {
        MembershipModel.getMemberRegistrationInfo = origGetReg;
        MembershipModel.createRenewalRequest = origCreateReq;
        NotificationService.create = origNotifCreate;
        PlanModel.findById = origPlanFind;
    });

    MembershipModel.getMemberRegistrationInfo = async () => ({
        id: 10,
        nombre: "Carlos",
        apellido: "Santamaría",
        dni: "73781820",
        telefono: "987654321",
    });

    // Missing proof on Yape fails with 400
    let res = makeRes();
    await MembershipController.requestRenewal(
        { memberId: 10, body: { planId: 1, metodoPago: "yape" } },
        res,
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /pantallazo/);

    // Valid Yape screenshot creates request & notifies admin
    let createdPayload = null;
    let notified = null;
    MembershipModel.createRenewalRequest = async (payload) => {
        createdPayload = payload;
        return { id: 77, planNombre: "Trimestral", montoFinal: 200 };
    };
    NotificationService.create = async (n) => {
        notified = n;
        return 1;
    };

    res = makeRes();
    await MembershipController.requestRenewal(
        {
            memberId: 10,
            body: {
                planId: 3,
                metodoPago: "yape",
                comprobanteUrl: "data:image/png;base64,abc123",
                numeroOperacion: "112233",
            },
        },
        res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.telefonoContacto, "987654321");
    assert.equal(notified.rolDestino, "admin");
    assert.equal(notified.tipo, "renovacion_solicitud");
    assert.match(notified.mensaje, /Carlos Santamaría/);
});

test("OfferService.consumeFriendPassAttendance enforces max invites per pass and increments attendance guests", async () => {
    const state = {
        offer: {
            id: 5,
            usuarioId: 10,
            tipo: "pase_amigo",
            valor: 2,
            estado: "activo",
            fechaFin: new Date("2028-01-01"),
            cuposMaximos: 1,
            cuposUsados: 0,
        },
        uso: null,
        attGuests: 0,
    };

    const conn = {
        execute: async (sql, args = []) => {
            if (sql.includes("FROM ofertas_socios") && sql.includes("FOR UPDATE")) {
                return [[{ ...state.offer }]];
            }
            if (sql.includes("FROM ofertas_usos")) {
                return [state.uso ? [{ ...state.uso }] : []];
            }
            if (sql.startsWith("INSERT INTO ofertas_usos")) {
                state.uso = { id: 1, cantidadInvitados: args[5] };
                return [{ insertId: 1 }];
            }
            if (sql.startsWith("UPDATE ofertas_usos")) {
                state.uso.cantidadInvitados += args[0];
                return [{ affectedRows: 1 }];
            }
            if (sql.startsWith("UPDATE ofertas_socios SET cupos_usados")) {
                state.offer.cuposUsados = args[0];
                state.offer.estado = args[1];
                return [{ affectedRows: 1 }];
            }
            if (sql.startsWith("UPDATE ofertas_socios SET estado = 'canjeado'")) {
                state.offer.estado = "canjeado";
                return [{ affectedRows: 1 }];
            }
            if (sql.startsWith("UPDATE asistencias")) {
                state.attGuests += args[0];
                return [{ affectedRows: 1 }];
            }
            return [[]];
        },
    };

    // Invite 1 friend first -> still active because valor=2
    await OfferService.consumeFriendPassAttendance(conn, {
        userId: 10,
        ofertaId: 5,
        cantidad: 1,
        asistenciaId: 99,
        invitadoNombres: "Luis",
    });
    assert.equal(state.uso.cantidadInvitados, 1);
    assert.equal(state.offer.estado, "activo");
    assert.equal(state.attGuests, 1);

    // Invite 2nd friend -> exhausts personal pass (2/2)
    await OfferService.consumeFriendPassAttendance(conn, {
        userId: 10,
        ofertaId: 5,
        cantidad: 1,
        asistenciaId: 100,
        invitadoNombres: "Ana",
    });
    assert.equal(state.uso.cantidadInvitados, 2);
    assert.equal(state.offer.estado, "canjeado");
    assert.equal(state.attGuests, 2);

    // 3rd invite rejected
    await assert.rejects(
        OfferService.consumeFriendPassAttendance(conn, {
            userId: 10,
            ofertaId: 5,
            cantidad: 1,
            asistenciaId: 101,
        }),
        /no está activo/,
    );
});

test("MembershipController.approveRenewalRequest ignores forged plan/method overrides in body", async (t) => {
    const origApprove = MembershipModel.approveRenewalRequest;
    const origFindUser = require("../src/models/UserModel").findActiveById;
    const origNotif = NotificationService.create;
    t.after(() => {
        MembershipModel.approveRenewalRequest = origApprove;
        require("../src/models/UserModel").findActiveById = origFindUser;
        NotificationService.create = origNotif;
    });

    let receivedArgs = null;
    MembershipModel.approveRenewalRequest = async (args) => {
        receivedArgs = args;
        return {
            request: { id: 15, usuario_id: 22, plan_id: 3, metodo_pago: "yape" },
            membership: {
                membresiaId: 90,
                planNombre: "Trimestral",
                fechaInicio: "2026-12-20",
                fechaFin: "2027-04-02",
                diasExtra: 0,
                monto: 160,
                metodoPago: "yape",
            },
        };
    };
    require("../src/models/UserModel").findActiveById = async () => null;
    NotificationService.create = async () => 1;

    const res = makeRes();
    await MembershipController.approveRenewalRequest(
        {
            params: { id: "15" },
            auth: { id: 1 },
            body: { planId: 5, fechaInicio: "2099-01-01", metodoPago: "efectivo" },
        },
        res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(receivedArgs, { requestId: 15, adminId: 1 });
});

test("MembershipModel.approveRenewalRequest locks plan/method to request and enforces start continuity", async (t) => {
    const origGetConn = db.getConnection;
    const origRenew = MembershipModel.renewMembership;
    t.after(() => {
        db.getConnection = origGetConn;
        MembershipModel.renewMembership = origRenew;
    });

    const today = new Date();
    const futureEnd = new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10);

    const fakeConn = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql) => {
            if (sql.includes("FROM solicitudes_renovacion")) {
                return [[{
                    id: 15,
                    usuario_id: 22,
                    plan_id: 3,
                    oferta_id: 8,
                    codigo_cupon: "PANDA20",
                    metodo_pago: "yape",
                    estado: "pendiente",
                    fecha_inicio_sugerida: "2020-01-01",
                }]];
            }
            if (sql.includes("FROM membresias")) {
                return [[{ fechaFin: futureEnd }]];
            }
            return [[]];
        },
    };
    db.getConnection = async () => fakeConn;

    let renewArgs = null;
    MembershipModel.renewMembership = async (args) => {
        renewArgs = args;
        return { membresiaId: 101, planNombre: "Trimestral", fechaInicio: args.fechaInicio, fechaFin: "2027-04-01", diasExtra: 0, monto: 160, metodoPago: args.metodoPago };
    };

    await MembershipModel.approveRenewalRequest({ requestId: 15, adminId: 1 });
    assert.equal(renewArgs.planId, 3);
    assert.equal(renewArgs.metodoPago, "yape");
    assert.equal(renewArgs.fechaInicio, futureEnd);
    assert.equal(renewArgs.codigoCupon, "PANDA20");
    assert.equal(renewArgs.ofertaId, 8);
});

test("GuestController blocks standalone Friend Pass redemption without member accompaniment", async () => {
    const GuestController = require("../src/controllers/GuestController");

    const resCreate = makeRes();
    await GuestController.createGuest(
        {
            auth: { id: 1 },
            body: {
                nombre: "Amigo Solo",
                telefono: "999888777",
                fechaInicio: "2026-11-26T10:00:00",
                fechaFin: "2026-11-26T11:00:00",
                codigoPase: "AMIGOPANDA",
            },
        },
        resCreate,
    );
    assert.equal(resCreate.statusCode, 400);
    assert.match(resCreate.body.message, /acompañados del socio/i);

    const resValidate = makeRes();
    await GuestController.validateFriendPass({ body: { codigoPase: "AMIGOPANDA" } }, resValidate);
    assert.equal(resValidate.statusCode, 400);
    assert.match(resValidate.body.message, /acompañados del socio/i);
});

test("OfferService.createOffer stores null coupon code for pase_amigo passes", async (t) => {
    const origExecute = db.execute;
    const origNotif = NotificationService.create;
    t.after(() => {
        db.execute = origExecute;
        NotificationService.create = origNotif;
    });

    let capturedParams = null;
    let capturedNotif = null;
    db.execute = async (sql, params) => {
        if (sql.includes("INSERT INTO ofertas_socios")) {
            capturedParams = params;
            return [{ insertId: 55 }];
        }
        return [[]];
    };
    NotificationService.create = async (n) => {
        capturedNotif = n;
        return 1;
    };

    const created = await OfferService.createOffer({
        usuarioId: 10,
        titulo: "Pase Sábado",
        tipo: "pase_amigo",
        valor: 2,
        codigoCupon: "IGNORA_ESTO",
    });

    assert.equal(created.codigoCupon, null);
    assert.equal(capturedParams[5], null);
    assert.doesNotMatch(capturedNotif.mensaje, /Código/i);
    assert.match(capturedNotif.mensaje, /acompañado/i);
});




