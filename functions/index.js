const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin     = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

/**
 * Gmail for Nodemailer:
 * - Legacy: firebase functions:config:set gmail.user gmail.password
 * - Gen2 Cloud Run env: GMAIL_USER / GMAIL_PASSWORD or EMAIL / PASSWORD_EMAIL
 */
function getGmailCredentials() {
  let legacy = {};
  try {
    if (typeof functions.config === "function") {
      legacy = functions.config().gmail || {};
    }
  } catch (e) {
    console.warn("functions.config:", e.message);
  }
  const user = String(
    legacy.user || process.env.GMAIL_USER || process.env.EMAIL || ""
  ).trim();
  const password = String(
    legacy.password ||
      process.env.GMAIL_PASSWORD ||
      process.env.PASSWORD_EMAIL ||
      ""
  ).trim();
  return { user, password };
}

/** Nodemailer transport; built lazily so deploy-time code analysis does not require runtime config. */
function getMailTransport() {
  const { user, password } = getGmailCredentials();
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: password },
  });
}

function pickCardImageSrc(dataUrlB64, storageUrl) {
  const url = String(storageUrl || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return String(dataUrlB64 || "").trim();
}

function escapeHtmlAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// â”€â”€ TRIGGER: nueva entrada en emailQueue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.enviarInformeSeguro = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .firestore
  .document("emailQueue/{docId}")
  .onCreate(async (snap, context) => {
    const d = snap.data();

    // â”€â”€ HTML DEL EMAIL â€” INFORME PROFESIONAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const morado = "#7c3aed";
    const azul   = "#3b82f6";

    const f = (val) => val || "—";
    const fila = (label, valor, color="") => `
      <tr>
        <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                   letter-spacing:.06em;white-space:nowrap;border-bottom:1px solid #2d2d3d;">${label}</td>
        <td style="padding:8px 14px;font-size:14px;color:${color||"#e2e8f0"};border-bottom:1px solid #2d2d3d;
                   font-weight:${color?"700":"400"};">${f(valor)}</td>
      </tr>`;

    const frontSrc = pickCardImageSrc(d.b64Front, d.urlFrente);
    const backSrc = pickCardImageSrc(d.b64Back, d.urlReverso);
    const imgFront = frontSrc
      ? `<img src="${escapeHtmlAttr(frontSrc)}" alt="Front of insurance card"
              style="width:100%;max-width:340px;border-radius:8px;border:2px solid #2d2d3d;display:block;margin:0 auto;" />`
      : `<div style="width:100%;height:120px;background:#1e1e2e;border:1px dashed #334155;border-radius:8px;
              display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">No image</div>`;
    const imgBack = backSrc
      ? `<img src="${escapeHtmlAttr(backSrc)}" alt="Back of insurance card"
              style="width:100%;max-width:340px;border-radius:8px;border:2px solid #2d2d3d;display:block;margin:0 auto;" />`
      : `<div style="width:100%;height:120px;background:#1e1e2e;border:1px dashed #334155;border-radius:8px;
              display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">No image</div>`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Insurance Verification Report</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Helvetica Neue',Arial,sans-serif;">

  <!-- â”€â”€ WRAPPER â”€â”€ -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">

    <!-- TARJETA PRINCIPAL -->
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:#16162a;
           border:1px solid #2d2d3d;border-radius:16px;overflow:hidden;">

      <!-- â”€â”€ HEADER CON GRADIENTE â”€â”€ -->
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px 36px;text-align:center;">
          <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;
                      color:rgba(255,255,255,0.7);margin-bottom:8px;">MedAuth Pro</div>
          <div style="font-size:28px;font-weight:800;color:#fff;margin:0 0 6px;letter-spacing:-.02em;">
            Medical Insurance Verification
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,0.75);">Bariatric surgery · Automated report</div>
        </td>
      </tr>

      <tr><td style="padding:28px 36px;">

        <!-- â”€â”€ IMAGEN DE LA TARJETA â”€â”€ -->
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:20px;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;
                      color:${azul};margin-bottom:16px;border-bottom:1px solid #2d2d3d;padding-bottom:10px;">
            💳 Insurance card — captured images
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:8px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${morado};
                            letter-spacing:.1em;margin-bottom:8px;">🪪 Front</div>
                ${imgFront}
              </td>
              <td width="50%" style="padding-left:8px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#06b6d4;
                            letter-spacing:.1em;margin-bottom:8px;">🔄 Back</div>
                ${imgBack}
              </td>
            </tr>
          </table>
        </div>

        <!-- â”€â”€ IDENTIFICACIÃ“N DEL SEGURO â”€â”€ -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:${morado};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            🪪 Insurance identification
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #2d2d3d;">
            ${fila("Patient", d.nombre, "#e2e8f0")}
            ${fila("Insurance Company", d.aseguradora, "#c4b5fd")}
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

        <!-- â”€â”€ COPAGOS Y COSTOS â”€â”€ -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:#06b6d4;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            💊 Copays and medical costs
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

        <!-- â”€â”€ FARMACIA â”€â”€ -->
        ${d.rxBin||d.rxPcn||d.rxGrp ? `
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:${azul};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            💊 Pharmacy plan
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
            ${fila("RxBIN / Rx BIN#", d.rxBin)}
            ${fila("RxPCN / Rx PCN", d.rxPcn)}
            ${fila("RxGRP / Rx Group", d.rxGrp)}
          </table>
        </div>` : ""}

        <!-- â”€â”€ PCP Y TELÃ‰FONOS â”€â”€ -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:#94a3b8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">
            📞 Contacts and PCP
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
            ${fila("Member Services Phone", d.phoneSeguro, "#6ee7b7")}
            ${fila("Prior authorization phone", d.phoneAuth)}
            ${fila("PCP Name", d.pcpName)}
            ${fila("PCP Phone", d.pcpPhone)}
            ${fila("Website", d.website)}
          </table>
        </div>

        <!-- â”€â”€ VERIFICACIÃ“N â€” SCRIPT DE LLAMADA â”€â”€ -->
        <div style="margin-bottom:24px;background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
                      color:#94a3b8;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2d2d3d;">
            📋 Verification call script — answers
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${fila("1. Covered?", d.cobertura, "")}
            ${fila("2. Prior authorization?", d.autorizacion, "")}
            ${fila("3. PCP referral?", d.referencia)}
            ${fila("4. Specific facility?", d.facilidad)}
            ${d.facilidadDetalle ? fila("   Facility detail", d.facilidadDetalle) : ""}
            ${fila("5. Total Deductible (call)", d.deducibleTotal)}
            ${fila("   Deductible met", d.deducibleMet)}
            ${fila("   Copay / Coinsurance (call)", d.copago)}
            ${fila("   Out-of-pocket max.", d.oopMax)}
            ${fila("Insurance Rep.", d.repName)}
            ${fila("Reference number", d.refNum)}
          </table>
          ${d.notasRep ? `
          <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid #2d2d3d;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Additional Notes</div>
            <div style="font-size:14px;color:#cbd5e1;line-height:1.6;">${d.notasRep}</div>
          </div>` : ""}
        </div>

        <!-- â”€â”€ EXPEDIENTE META â”€â”€ -->
        <div style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);
                    border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:16px;">
          <div style="font-size:11px;color:#a78bfa;font-weight:600;">
            📁 Record ID: <code style="font-family:monospace;color:#c4b5fd;">${f(d.expedienteId)}</code>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">
            Date: ${d.fecha ? new Date(d.fecha._seconds*1000).toLocaleString("en-US",{timeZone:"America/Bogota"}) : new Date().toLocaleString("en-US",{timeZone:"America/Bogota"})}
          </div>
        </div>

      </td></tr>

      <!-- â”€â”€ FOOTER â”€â”€ -->
      <tr>
        <td style="background:#0d0d1f;padding:20px 36px;text-align:center;border-top:1px solid #2d2d3d;">
          <p style="font-size:12px;color:#475569;margin:0;line-height:1.6;">
            This report was automatically generated by <strong style="color:#7c3aed;">MedAuth Pro</strong><br/>
            Email sent to: <a href="mailto:michaelandresfloreshenao@gmail.com"
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

    // â”€â”€ Asunto del email â”€â”€
    const asunto = `MedAuth Pro — ${f(d.nombre)} — Insurance verification`;

    const { user: gmailFrom } = getGmailCredentials();
    if (!gmailFrom) {
      console.error("enviarInformeSeguro: missing Gmail user");
      throw new Error("Gmail not configured");
    }
    await getMailTransport().sendMail({
      from:    `"MedAuth Pro" <${gmailFrom}>`,
      to:      d.emailDestino || "michaelandresfloreshenao@gmail.com",
      subject: asunto,
      html:    html,
    });

    console.log(`Report sent — ${d.nombre} — resultado: ${d.resultado || "—"}`);

    // Mark queue entry as sent
    await snap.ref.update({ emailEnviado: true, emailDate: admin.firestore.FieldValue.serverTimestamp() });
    return null;
  });

/** Callable from Hosting — sends HTML email (same Gmail config as enviarInformeSeguro). */
exports.submitVerificationReport = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const payload = request.data || {};
    const report = payload.report;
    if (!report || typeof report !== "object") {
      throw new HttpsError("invalid-argument", "Missing report");
    }

    const subject = payload.subject;
    const htmlReport = payload.html_report;
    if (subject == null || subject === "" || htmlReport == null || htmlReport === "") {
      throw new HttpsError("invalid-argument", "Missing subject or html_report");
    }

    const { user: gmailUser, password: gmailPass } = getGmailCredentials();
    if (!gmailUser || !gmailPass) {
      throw new HttpsError(
        "failed-precondition",
        "Gmail is not configured. Set gmail.user / gmail.password (firebase functions:config:set) or GMAIL_USER + GMAIL_PASSWORD on the Cloud Run service, then redeploy."
      );
    }

    try {
      await getMailTransport().sendMail({
        from: `"MedAuth Pro" <${gmailUser}>`,
        to: report.emailDestino || "michaelandresfloreshenao@gmail.com",
        subject: String(subject),
        text: payload.text != null ? String(payload.text) : "",
        html: String(htmlReport),
      });
    } catch (err) {
      console.error("submitVerificationReport sendMail:", err && err.message, err);
      throw new HttpsError(
        "internal",
        "Email send failed. Check Gmail app password and function logs."
      );
    }

    return { ok: true };
  }
);

