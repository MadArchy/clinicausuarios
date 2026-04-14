const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ── TRANSPORTE DE GMAIL ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().gmail.user,
    pass: functions.config().gmail.password,
  },
});

// ── TRIGGER: nueva entrada en emailQueue ───────────────────────
exports.enviarInformeSeguro = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .firestore
  .document("emailQueue/{docId}")
  .onCreate(async (snap, context) => {
    const d = snap.data();

    // ── HTML DEL EMAIL — INFORME PROFESIONAL ──────────────────
    const esApto = d.resultado === "APTO";
    const verde  = "#10b981";
    const rojo   = "#ef4444";
    const morado = "#7c3aed";
    const azul   = "#3b82f6";
    const gris   = "#1e1e2e";

    const f = (val) => val || "—";
    const fila = (label, valor, color="") => `
      <tr>
        <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                   letter-spacing:.06em;white-space:nowrap;border-bottom:1px solid #2d2d3d;">${label}</td>
        <td style="padding:8px 14px;font-size:14px;color:${color||"#e2e8f0"};border-bottom:1px solid #2d2d3d;
                   font-weight:${color?"700":"400"};">${f(valor)}</td>
      </tr>`;

    const chip = (val) =>
      `<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;
              background:${esApto?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.12)"};
              color:${esApto?verde:rojo};border:1px solid ${esApto?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"};">
        ${esApto?"✅ APTO":"❌ NO APTO"}
      </span>`;

    // Imágenes de la tarjeta como base64 inline
    const imgFront = d.b64Front
      ? `<img src="${d.b64Front}" alt="Frente de la tarjeta"
              style="width:100%;max-width:340px;border-radius:8px;border:2px solid #2d2d3d;display:block;margin:0 auto;" />`
      : `<div style="width:100%;height:120px;background:#1e1e2e;border:1px dashed #334155;border-radius:8px;
              display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">Sin imagen</div>`;
    const imgBack = d.b64Back
      ? `<img src="${d.b64Back}" alt="Reverso de la tarjeta"
              style="width:100%;max-width:340px;border-radius:8px;border:2px solid #2d2d3d;display:block;margin:0 auto;" />`
      : `<div style="width:100%;height:120px;background:#1e1e2e;border:1px dashed #334155;border-radius:8px;
              display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">Sin imagen</div>`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Informe de Verificación de Seguro</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Helvetica Neue',Arial,sans-serif;">

  <!-- ── WRAPPER ── -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">

    <!-- TARJETA PRINCIPAL -->
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:#16162a;
           border:1px solid #2d2d3d;border-radius:16px;overflow:hidden;">

      <!-- ── HEADER CON GRADIENTE ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px 36px;text-align:center;">
          <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;
                      color:rgba(255,255,255,0.7);margin-bottom:8px;">MedAuth Pro</div>
          <div style="font-size:28px;font-weight:800;color:#fff;margin:0 0 6px;letter-spacing:-.02em;">
            Verificación de Seguro Médico
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,0.75);">Cirugía Bariátrica · Informe Automático</div>
        </td>
      </tr>

      <!-- ── RESULTADO DESTACADO ── -->
      <tr>
        <td style="padding:28px 36px;text-align:center;background:${esApto?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.07)"};
                   border-bottom:1px solid ${esApto?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)"};">
          <div style="font-size:44px;margin-bottom:10px;">${esApto?"🎉":"⚠️"}</div>
          <div style="display:inline-block;padding:8px 24px;border-radius:99px;font-size:22px;font-weight:800;
                      background:${esApto?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.12)"};
                      color:${esApto?verde:rojo};border:2px solid ${esApto ? verde : rojo};">
            ${esApto?"✅ APTO":"❌ NO APTO"}
          </div>
          <p style="color:${esApto?"#a7f3d0":"#fca5a5"};font-size:14px;margin:12px 0 0;line-height:1.5;">
            ${esApto
              ? `<strong style="color:#fff;">${f(d.nombre)}</strong> cumple los criterios de elegibilidad para la cirugía bariátrica.`
              : `<strong style="color:#fff;">${f(d.nombre)}</strong> NO cumple todos los criterios en este momento.`}
          </p>
        </td>
      </tr>

      <tr><td style="padding:28px 36px;">

        <!-- ── IMAGEN DE LA TARJETA ── -->
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:20px;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;
                      color:${azul};margin-bottom:16px;border-bottom:1px solid #2d2d3d;padding-bottom:10px;">
            💳 Tarjeta del Seguro — Imágenes Capturadas
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:8px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${morado};
                            letter-spacing:.1em;margin-bottom:8px;">🪪 Frente</div>
                ${imgFront}
              </td>
              <td width="50%" style="padding-left:8px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#06b6d4;
                            letter-spacing:.1em;margin-bottom:8px;">🔄 Reverso</div>
                ${imgBack}
              </td>
            </tr>
          </table>
        </div>

        <!-- ── IDENTIFICACIÓN DEL SEGURO ── -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:${morado};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            🪪 Identificación del Seguro
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #2d2d3d;">
            ${fila("Paciente", d.nombre, "#e2e8f0")}
            ${fila("Aseguradora", d.aseguradora, "#c4b5fd")}
            ${fila("Subscriber Name", d.subscriberName)}
            ${fila("Member Name", d.memberName)}
            ${fila("Member ID / ID #", d.memberId, "#93c5fd")}
            ${fila("Subscriber ID", d.subscriberId)}
            ${fila("Group Number", d.groupNum, "#93c5fd")}
            ${fila("Plan Name", d.planName)}
            ${fila("Plan Type", d.planType)}
            ${fila("Effective Date", d.effectiveDate)}
            ${fila("Date of Birth (DOB)", d.dob)}
            ${fila("Network", d.network)}
            ${fila("Type of Coverage", d.coverage)}
          </table>
        </div>

        <!-- ── COPAGOS Y COSTOS ── -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:#06b6d4;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            💊 Copagos y Costos Médicos
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
            ${fila("PCP / Primary Care Copay", d.copayPCP)}
            ${fila("Specialist Copay", d.copaySpec)}
            ${fila("Emergency Room (ER)", d.copayER)}
            ${fila("Urgent Care", d.copayUrgent)}
            ${fila("Deductible (Med/Rx)", d.deductible)}
            ${fila("Coinsurance", d.coinsurance)}
          </table>
        </div>

        <!-- ── FARMACIA ── -->
        ${d.rxBin||d.rxPcn||d.rxGrp ? `
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:${azul};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            💊 Plan de Farmacia
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
            ${fila("RxBIN / Rx BIN#", d.rxBin)}
            ${fila("RxPCN / Rx PCN", d.rxPcn)}
            ${fila("RxGRP / Rx Group", d.rxGrp)}
          </table>
        </div>` : ""}

        <!-- ── PCP Y TELÉFONOS ── -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:#94a3b8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            📞 Contactos y PCP
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
            ${fila("Tel. Member Services", d.phoneSeguro, "#6ee7b7")}
            ${fila("Tel. Autorización Previa", d.phoneAuth)}
            ${fila("PCP Name", d.pcpName)}
            ${fila("PCP Phone", d.pcpPhone)}
            ${fila("Sitio Web", d.website)}
          </table>
        </div>

        <!-- ── VERIFICACIÓN — SCRIPT DE LLAMADA ── -->
        <div style="margin-bottom:24px;background:#1e1e2e;border:1px solid ${esApto?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.2)"};border-radius:12px;padding:20px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:${esApto?verde:rojo};margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2d2d3d;">
            📋 Preguntas del Script de Verificación
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${fila("1. ¿Cubierta? (Is it covered?)", d.cobertura,
              ["Si","Parcial"].includes(d.cobertura)?verde:rojo)}
            ${fila("2. ¿Autorización previa?", d.autorizacion,
              d.autorizacion?.includes("Obtenida")||d.autorizacion?.includes("No Requerida")?verde:rojo)}
            ${fila("3. ¿Referencia del PCP?", d.referencia)}
            ${fila("4. ¿Facilidad específica?", d.facilidad)}
            ${d.facilidadDetalle ? fila("   Detalle facilidad", d.facilidadDetalle) : ""}
            ${fila("5. Deducible total (llamada)", d.deducibleTotal)}
            ${fila("   Deducible cumplido", d.deducibleMet)}
            ${fila("   Copago / Coseguro (llamada)", d.copago)}
            ${fila("   Out-of-Pocket Máximo", d.oopMax)}
            ${fila("Rep. del seguro", d.repName)}
            ${fila("Número de referencia", d.refNum)}
          </table>
          ${d.notasRep ? `
          <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid #2d2d3d;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Notas Adicionales</div>
            <div style="font-size:14px;color:#cbd5e1;line-height:1.6;">${d.notasRep}</div>
          </div>` : ""}
        </div>

        <!-- ── EXPEDIENTE META ── -->
        <div style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);
                    border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:16px;">
          <div style="font-size:11px;color:#a78bfa;font-weight:600;">
            📁 ID Expediente: <code style="font-family:monospace;color:#c4b5fd;">${f(d.expedienteId)}</code>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">
            Fecha: ${d.fecha ? new Date(d.fecha._seconds*1000).toLocaleString("es-CO",{timeZone:"America/Bogota"}) : new Date().toLocaleString("es-CO")}
          </div>
        </div>

      </td></tr>

      <!-- ── FOOTER ── -->
      <tr>
        <td style="background:#0d0d1f;padding:20px 36px;text-align:center;border-top:1px solid #2d2d3d;">
          <p style="font-size:12px;color:#475569;margin:0;line-height:1.6;">
            Este informe fue generado automáticamente por <strong style="color:#7c3aed;">MedAuth Pro</strong><br/>
            Correo enviado a: <a href="mailto:michaelandresfloreshenao@gmail.com"
              style="color:#7c3aed;text-decoration:none;">michaelandresfloreshenao@gmail.com</a>
          </p>
        </td>
      </tr>

    </table>

  </td></tr>
  </table>

</body>
</html>
    `;

    // ── Asunto del email ──
    const asunto = `[${d.resultado}] ${f(d.nombre)} — Verificación de Seguro Bariátrico`;

    await transporter.sendMail({
      from:    `"MedAuth Pro" <${functions.config().gmail.user}>`,
      to:      d.emailDestino || "michaelandresfloreshenao@gmail.com",
      subject: asunto,
      html:    html,
    });

    console.log(`✅ Informe enviado — ${d.nombre} — ${d.resultado}`);

    // Limpiar el queue
    await snap.ref.update({ emailEnviado: true, emailFecha: admin.firestore.FieldValue.serverTimestamp() });
    return null;
  });
