/* ============================================================
   MedAuth Pro — client-side OCR for US insurance cards
   (Ambetter, Amerigroup, BCBS, Christus, Molina, and similar)
   ============================================================ */
"use strict";

// â”€â”€ ESTADO GLOBAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const State = {
  step: 1,
  files:   { front: null, back: null },
  urls:    { front: null, back: null },
  b64:     { front: null, back: null },        // base64 for email attachment
  ocr:     {},                                  // raw extracted OCR payload
  answers: { q1:null, q2:null, q3:null, q4:null },
};

const STEP_LABELS = [
  { label: "Patient data & insurance card", pct: 33 },
  { label: "Insurance call script", pct: 66 },
  { label: "Final result", pct: 100 },
];

// â”€â”€ NAVEGACIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateProgress(step) {
  const c = STEP_LABELS[step-1];
  document.getElementById("progressFill").style.width  = c.pct+"%";
  document.getElementById("progressLabel").textContent = `Step ${step} of 3`;
  document.getElementById("progressCount").textContent = c.label;
  for (let i=1;i<=3;i++){
    const d=document.getElementById(`dot-${i}`);
    if(!d) return;
    d.classList.remove("active","completed");
    if(i<step)        d.classList.add("completed");
    else if(i===step) d.classList.add("active");
  }
}

function goToScript() {
  const banner = document.getElementById('formErrorBanner');
  if (banner) banner.style.display = 'none';

  const nm  = v('f_subscriberName') || v('f_memberName') || '—';
  const mid = v('f_memberId') || v('f_subscriberId') || '—';
  const grp = v('f_groupNum') || '—';
  
  if (document.getElementById('scriptName')) document.getElementById('scriptName').textContent = nm;
  if (document.getElementById('scriptMid')) document.getElementById('scriptMid').textContent = mid;
  if (document.getElementById('scriptGrp')) document.getElementById('scriptGrp').textContent = grp;
  if (document.getElementById('scriptNameInline')) document.getElementById('scriptNameInline').textContent = nm;
  if (document.getElementById('scriptMidInline')) document.getElementById('scriptMidInline').textContent = mid;
  if (document.getElementById('scriptGrpInline')) document.getElementById('scriptGrpInline').textContent = grp;
  
  const phone = v('f_phone');
  if (phone) {
    if (document.getElementById('phoneChipWrapper')) document.getElementById('phoneChipWrapper').style.display = 'block';
    if (document.getElementById('noPhoneNote')) document.getElementById('noPhoneNote').style.display = 'none';
    if (document.getElementById('phoneChip')) document.getElementById('phoneChip').innerHTML = '<span class="material-symbols-outlined">call</span> ' + phone;
  }
  showStep(2);
}

function prevStep(from) { showStep(from-1); }

function showStep(to) {
  document.querySelectorAll(".form-section").forEach(s=>s.classList.remove("active"));
  document.getElementById(`step-${to}`).classList.add("active");
  State.step = to;
  updateProgress(to);
  window.scrollTo({top:0, behavior:"smooth"});
}

// â”€â”€ MANEJO DE ARCHIVOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function handleCard(side, event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith("image/")) {
    alert("Only image files are allowed (JPG, PNG, WEBP, HEIC).");
    return;
  }
  State.files[side] = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    State.b64[side] = dataUrl;   // keep for email

    // Preview
    document.getElementById(`drop${cap(side)}`).style.display = "none";
    const cap_el = document.getElementById(`cap${cap(side)}`);
    cap_el.classList.add("visible");
    document.getElementById(`img${cap(side)}`).src = dataUrl;

    // Show toggle for extracted fields
    document.getElementById("ocrToggleSection").style.display = "block";

    // OCR
    runOCR(side, dataUrl);
  };
  reader.readAsDataURL(file);
}

function removeCard(side) {
  State.files[side] = null;
  State.urls[side]  = null;
  State.b64[side]   = null;
  document.getElementById(`file${cap(side)}`).value = "";
  document.getElementById(`drop${cap(side)}`).style.display = "flex";
  document.getElementById(`cap${cap(side)}`).classList.remove("visible");
  document.getElementById(`ocr${cap(side)}Panel`).classList.remove("visible");
  if (side === "front") clearFrontFields();
  else                  clearBackFields();
  if (!State.files.front && !State.files.back) {
    document.getElementById("extractedSection").style.display = "none";
    document.getElementById("ocrToggleSection").style.display = "none";
  }
}

function clearFrontFields() {
  FRONT_IDS.forEach(id => setField(id, ""));
}
function clearBackFields() {
  BACK_IDS.forEach(id => setField(id, ""));
  document.getElementById("phoneChipWrapper").style.display = "none";
  document.getElementById("noPhoneNote").style.display      = "block";
}

const FRONT_IDS = [
  "f_aseguradora","f_subscriberName","f_memberName","f_memberId","f_subscriberId",
  "f_groupNum","f_planName","f_planType","f_benefitPlan","f_effectiveDate","f_dob",
  "f_network","f_coverage","f_dependents",
  "f_copayPCP","f_copaySpec","f_copayER","f_copayUrgent","f_deductible","f_coinsurance",
  "f_rxBin","f_rxPcn","f_rxGrp","f_rxAdmin","f_rxGeneric","f_rxBrand","f_rxNonPref","f_rxSpecialty",
  "f_pcpName","f_pcpPhone","f_pcpEffDate","f_providerGroup","f_providerPhone","f_chipNum",
];
const BACK_IDS = ["f_phone","f_phoneAuth","f_phonePharmacy","f_phoneNurse","f_phoneBehavioral","f_websiteBack"];

// â”€â”€ OCR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function runOCR(side, dataUrl) {
  const panel = document.getElementById(`ocr${cap(side)}Panel`);
  const fill  = document.getElementById(`ocr${cap(side)}Fill`);
  const label = document.getElementById(`ocr${cap(side)}Label`);
  panel.classList.add("visible");
  label.textContent = side === "front" ? "Reading front of card..." : "Reading back of card...";
  fill.style.width = "5%";
  try {
    const worker = await Tesseract.createWorker("eng+spa", 1, {
      logger: m => {
        if (m.status === "recognizing text") {
          fill.style.width = Math.round(m.progress * 100) + "%";
          label.textContent = `Extracting text... ${Math.round(m.progress * 100)}%`;
        }
      },
    });
    const { data: { text } } = await worker.recognize(dataUrl);
    await worker.terminate();
    fill.style.width  = "100%";
    label.innerHTML = "<span class='material-symbols-outlined'>check_circle</span> Data extracted successfully";
    // Raw OCR text
    const rawBlock = document.getElementById("ocrRawBlock");
    const rawArea  = document.getElementById("ocrRawText");
    if (rawBlock && rawArea) {
      rawBlock.style.display = "block";
      const sep = "\n\n—— BACK ——\n";
      if (side === "front") {
        rawArea.value = text.trim();
      } else {
        rawArea.value = (rawArea.value ? rawArea.value + sep : "") + text.trim();
      }
    }
    if (side==="front") parseFront(text);
    else                parseBack(text);
  } catch(err) {
    label.innerHTML = "<span class='material-symbols-outlined'>warning</span> Read error — please enter the details manually";
    console.error("OCR error:", err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PARSER FRENTE â€” robusto, multi-formato, tolerante a ruido OCR
//  Soporta: Ambetter Â· Amerigroup Â· BlueCross/TX Â· Christus Â· Molina
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function parseFront(text) {

  // â”€â”€ 1. PREPROCESADO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // a) LÃ­neas limpias (quitamos ruido OCR: ><=|~`@#^*)
  const lines = text.split(/\r?\n/)
    .map(l => l.replace(/[><|~`@#\^*\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // b) Texto colapsado en una sola lÃ­nea (Ãºtil para patrones multi-lÃ­nea)
  const collapsed = lines.join(' ');

  // c) VersiÃ³n uppercase para comparaciones rÃ¡pidas
  const T = collapsed.toUpperCase();

  // â”€â”€ 2. HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Prueba patrones en collapsed y raw; devuelve primer match
  const tryPat = (patterns) => {
    for (const p of patterns) {
      const m = collapsed.match(p) || text.match(p);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    return '';
  };

  // Busca valor JUSTO despuÃ©s de una etiqueta (misma lÃ­nea o siguiente lÃ­nea)
  const afterLabel = (keywords) => {
    const kwArr = Array.isArray(keywords) ? keywords : [keywords];
    for (const kw of kwArr) {
      const ku = kw.toUpperCase();
      // 1. Intentar en collapsed
      const idx = T.indexOf(ku);
      if (idx !== -1) {
        const after = collapsed.slice(idx + kw.length).replace(/^\s*[:\-=]?\s*/, '').trim();
        const tok = after.split(/\s{2,}|\n/)[0].trim(); // hasta doble espacio o lÃ­nea nueva
        if (tok && tok.length >= 2) {
          return tok.replace(/\s+\d$/, '').trim(); // quitar dÃ­gito suelto al final (ruido OCR)
        }
      }
      // 2. Intentar lÃ­nea a lÃ­nea: etiqueta en lÃ­nea N, valor en lÃ­nea N o N+1
      for (let i = 0; i < lines.length; i++) {
        const lu = lines[i].toUpperCase();
        const pos = lu.indexOf(ku);
        if (pos === -1) continue;
        // Valor en la misma lÃ­nea (texto despuÃ©s del keyword + separador)
        const rest = lines[i].slice(pos + kw.length).replace(/^\s*[:\-=]?\s*/, '').trim();
        if (rest.length >= 2 && !/^[\d\s]*$/.test(rest) === false || /[A-Z0-9]{2}/.test(rest)) {
          return rest.replace(/\s+\d$/, '').trim();
        }
        // Valor en la siguiente lÃ­nea no vacÃ­a
        for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
          if (lines[j] && lines[j].trim().length >= 2) {
            return lines[j].trim();
          }
        }
      }
    }
    return '';
  };

  // Extrae primer nÃºmero de telÃ©fono formateado
  const ph = (s) => {
    if (!s) return '';
    const d = s.replace(/\D/g, '').slice(-10);
    return d.length >= 10 ? fmtPhone(d) : '';
  };

  // â”€â”€ 3. ASEGURADORA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let aseg = '';
  const insurerMap = [
    ['BLUE CROSS BLUE SHIELD OF TEXAS','Blue Cross Blue Shield of Texas'],
    ['BLUECROSS BLUESHIELD OF TEXAS','Blue Cross Blue Shield of Texas'],
    ['BCBSTX','Blue Cross Blue Shield of Texas'],
    ['BLUE CROSS BLUE SHIELD','Blue Cross Blue Shield'],
    ['BLUECROSS BLUESHIELD','Blue Cross Blue Shield'],
    ['BLUE CROSS','Blue Cross'],['BLUE SHIELD','Blue Shield'],['BCBS','BCBS'],
    ['AMBETTER','Ambetter'],['SUPERIOR HEALTHPLAN','Superior Healthplan'],
    ['AMERIGROUP','Amerigroup'],['ANTHEM','Anthem'],
    ['UNITEDHEALTH','UnitedHealth'],['UNITEDHEALTHCARE','UnitedHealthcare'],
    ['UNITED HEALTHCARE','UnitedHealthcare'],
    ['AETNA','Aetna'],['CIGNA','Cigna'],['HUMANA','Humana'],
    ['MOLINA','Molina Healthcare'],['CHRISTUS','Christus Health Plan'],
    ['CENTENE','Centene'],['OSCAR','Oscar'],['MAGELLAN','Magellan'],
    ['COVENTRY','Coventry'],['WELLCARE','WellCare'],['TRICARE','Tricare'],
    ['CHIP','CHIP / Medicaid'],['MEDICAID','Medicaid'],['MEDICARE','Medicare'],
    ['TEXAS CHILDREN','Texas Children\'s Health Plan'],
    ['COMMUNITY HEALTH','Community Health Choice'],
  ];
  for (const [k,n] of insurerMap) { if (T.includes(k)) { aseg=n; break; } }

  // â”€â”€ 4. SUBSCRIBER NAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let subscriberName = tryPat([
    /Subscriber\s*Name\s*[:\-]?\s*([A-Z][A-Za-z\.\s\-']{2,40})/i,
    /Subscriber\s*[:\-]\s*([A-Z][A-Za-z\.\s\-']{2,40})/i,
    /Suscriptor\s*[:\-]?\s*([A-Z][A-Za-z\.\s\-']{2,40})/i,
  ]);
  // Limpiar "SubscrberNamer > =" (ruido OCR de "Subscriber Name:")
  if (!subscriberName) {
    const noisy = T.match(/SUBSCR[\w\s]*[>=\-:]+\s*([A-Z][A-Z\.\s]{4,40})/i);
    if (noisy) subscriberName = noisy[1].trim();
  }

  // â”€â”€ 5. MEMBER NAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Detectar nombre completo en mayÃºsculas (tÃ­pico en tarjetas)
  let memberName = tryPat([
    /Member\s*(?:Name)?\s*[:\-]?\s*([A-Z][A-Za-z\.\s\-']{3,40})/i,
    /Insured\s*[:\-]\s*([A-Z][A-Za-z\.\s\-']{3,40})/i,
  ]);
  // Fallback: buscar lÃ­nea que sea nombre (APELLIDO, Nombre Â· ej: JUAN J. VASQUEZ)
  if (!memberName) {
    for (const ln of lines) {
      if (/^[A-Z]{2,}(?:\s+[A-Z]\.?\s*)?[A-Z]{2,}$/.test(ln.trim())) {
        memberName = ln.trim(); break;
      }
    }
  }
  if (!memberName && subscriberName) memberName = subscriberName;

  // Si subscriber Name estÃ¡ vacÃ­o, usar memberName
  if (!subscriberName && memberName) subscriberName = memberName;

  // â”€â”€ 6. MEMBER ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let memberId = tryPat([
    /Identification\s*Number\s*[:\-]?\s*([A-Z]{0,4}\d{6,14}[A-Z0-9]*)/i,
    /Member\s*ID\s*[:\-#]?\s*([A-Z0-9]{5,20})/i,
    /MBR\s*ID\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /Member\s*Number\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /ID\s*#\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /\b([A-Z]{1,3}\d{7,14})\b/,   // ZGP829810078 â€” patrÃ³n genÃ©rico
    /\b(\d{8,14})\b/,
  ]);

  // â”€â”€ 7. SUBSCRIBER ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let subscriberId = tryPat([
    /Subscriber\s*(?:ID|#|Number)\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /CHIP\s*Perinate\s*(?:Number|#)?\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
  ]);
  if (subscriberId === memberId) subscriberId = '';

  // â”€â”€ 8. GROUP NUMBER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let groupNum = tryPat([
    /Group\s*(?:No\.?|Number|Num|#)\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /GRP\s*#?\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
  ]);

  // â”€â”€ 9. PLAN NAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Detectar nombre del plan (ej: BCA FAMILY, Balanced Care 1, etc.)
  let planName = tryPat([
    /Plan\s*[:\-]\s*(.{4,60})/i,
  ]);
  // Fallback: buscar lÃ­neas con palabras clave de plan
  if (!planName) {
    for (const ln of lines) {
      if (/\b(FAMILY|INDIVIDUAL|BALANCED|CARE|GOLD|SILVER|BRONZE|PLATINUM|CLASSIC|BASIC|SELECT)\b/i.test(ln)
          && !/\bCALL\b|\bWEB\b|\bPHONE\b|\bFAX\b/.test(ln.toUpperCase())) {
        planName = ln.replace(/^\s*[\-:]\s*/, '').trim().slice(0, 60);
        break;
      }
    }
  }
  // Detectar "BCA FAMILY" tipo BCBS TX
  if (!planName) {
    const bcaPlan = collapsed.match(/\b(BCA\s+\w+(?:\s+\w+)?)\b/i);
    if (bcaPlan) planName = bcaPlan[1].trim();
  }

  // â”€â”€ 10. PLAN TYPE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let planType = '';
  for (const pt of ['PPO','HMO','EPO','POS','HDHP','HSA','MAPD','TDI','CHIP','HIOPT','QHF','PCP']) {
    if (new RegExp('\\b'+pt+'\\b').test(T)) { planType = pt; break; }
  }

  // â”€â”€ 11. BENEFIT PLAN CODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let benefitPlan = tryPat([/Benefit\s*Plan\s+([A-Z0-9]{2,12})/i]);

  // â”€â”€ 12. EFFECTIVE DATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let effectiveDate = tryPat([
    /Coverage\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Member\s*Effective\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Effective\s*Date\s*(?:of\s*Coverage)?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Eff\.?\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // â”€â”€ 13. DATE OF BIRTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let dob = tryPat([
    /(?:Date\s*of\s*Birth|DOB)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // â”€â”€ 14. NETWORK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let network = '';
  if (T.includes('IN NETWORK COVERAGE ONLY')) network = 'In Network Coverage Only';
  else if (T.includes('IN-NETWORK'))           network = 'In Network';
  else if (T.includes('IN NETWORK'))           network = 'In Network';
  else if (T.includes('OUT OF NETWORK'))       network = 'Out of Network';

  // â”€â”€ 15. TYPE OF COVERAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let coverage = tryPat([/Type\s*(?:of)?\s*Coverage\s*[:\-]?\s*(\w[\w\s\-]{0,30})/i]);
  // BCBS TX: Detectar "BCA FAMILY TDI TX-EX" etc.
  if (!coverage) {
    if (T.includes('CHIP'))     coverage = 'CHIP';
    else if (T.includes('TDI')) coverage = 'TDI';
  }

  // â”€â”€ 16. DEPENDENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let dependents = '';
  const depLines = collapsed.match(/Dependent\s+(?:One|Two|Three|Four|\d+)|Member\s+\d+/gi);
  if (depLines) dependents = depLines.join(' Â· ');
  // Buscar "Pediatric Dental" como indicador de cobertura de dependientes
  if (!dependents && T.includes('PEDIATRIC DENTAL')) dependents = 'Pediatric Dental (under 19)';

  // â”€â”€ 17. COPAGOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let copayPCP = '', copaySpec = '', copayER = '', copayUrgent = '';

  // BCBS TX: "OV/Spec $40/80" â†’ PCP=$40, Specialist=$80
  const ovSpec = collapsed.match(/OV\s*\/\s*Spec\s*\$?(\d+)\s*\/\s*(\d+)/i);
  if (ovSpec) { copayPCP = '$' + ovSpec[1]; copaySpec = '$' + ovSpec[2]; }

  // Individual copay patterns
  if (!copayPCP) copayPCP = tryPat([
    /PCP\s*(?:Office\s*Visit)?\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Primary\s*Care\s*(?:Office\s*Visit)?\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Office\s*Visit\s+(\$[\d,.]+)/i,
  ]);
  if (!copaySpec) copaySpec = tryPat([
    /Specialist\s*(?:Office\s*Visit|Copay)?\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Spec\s*(?:ialist)?\s+(\$[\d,.]+)/i,
  ]);
  copayER = tryPat([
    /Emergency\s*Room\s*[:\-]?\s*(\$[\d,.]+)/i,
    /\bER\b\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Emergency\s+(\$[\d,.]+)/i,
  ]);
  copayUrgent = tryPat([/Urgent\s*Care\s*[:\-]?\s*(\$[\d,.]+)/i]);

  // â”€â”€ 18. DEDUCTIBLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let deductible = tryPat([
    /Deductible\s*(?:\(Med\/?Rx\))?\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Deductible\s+(\$[\d,.]+)/i,
  ]);

  // â”€â”€ 19. COINSURANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let coinsurance = tryPat([
    /Coinsurance\s*(?:\(Med\/?Rx\))?\s*[:\-]?\s*(\d+%)/i,
    /Co[- ]?insurance\s+(\d+%)/i,
  ]);

  // â”€â”€ 20. RxBIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rxBin = tryPat([
    /RxBIN\s*[:\-]?\s*(\d{4,10})/i,
    /Rx\s*BIN\s*#?\s*[:\-]?\s*(\d{4,10})/i,
    /BIN\s*[:\-]?\s*(\d{4,10})/i,
  ]);

  // â”€â”€ 21. RxPCN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rxPcn = tryPat([
    /RxPCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
    /Rx\s*PCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
    /PCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
  ]);

  // â”€â”€ 22. RxGRP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rxGrp = tryPat([
    /RxGRP\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /Rx\s*GR(?:P|OUP)\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /Rx\s*Group\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
  ]);

  // â”€â”€ 23. PHARMACY ADMINISTRATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let rxAdmin = tryPat([
    /Pharmacy\s*Benefits?\s*Manager\s*[:\-]?\s*([A-Za-z\s]{2,25})/i,
    /Administered\s*by\s*[:\-]?\s*([A-Za-z\s]{2,25})/i,
  ]);
  if (!rxAdmin) {
    for (const adm of ['PRIME','Express Scripts','CVS Caremark','OptumRx','Argus',
                        'Prime Therapeutics','Navitus','MedImpact','Magellan Rx']) {
      if (T.includes(adm.toUpperCase())) { rxAdmin = adm; break; }
    }
  }
  if (rxAdmin) rxAdmin = rxAdmin.trim();

  // â”€â”€ 24. DRUG TIERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // BCBS TX: "Rx Level 1 $10/20/70" y "Rx Level 2 $120/150/250"
  let rxGeneric = tryPat([
    /Rx\s*Level\s*1\s*(\$[\d]+\/[\d]+\/[\d]+)/i,
    /Generic\s*(?:Drugs?)?\s*[:\-]?\s*(\$[\d,.\/]+)/i,
  ]);
  let rxBrand = tryPat([
    /Rx\s*Level\s*2\s*(\$[\d]+\/[\d]+\/[\d]+)/i,
    /Preferred\s*Brand\s*(?:Drugs?)?\s*[:\-]?\s*(\$[\d,.]+)/i,
  ]);
  let rxNonPref = tryPat([
    /Non[\s\-]?Preferred\s*Brand\s*(?:Drugs?)?\s*[:\-]?\s*(\$[\d,.]+)/i,
  ]);
  let rxSpecialty = tryPat([
    /Specialty\s*(?:Drugs?)?\s*[:\-]?\s*(\$[\d,.]+)/i,
  ]);

  // â”€â”€ 25. PCP / PROVIDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let pcpName = tryPat([/PCP\s*(?:Name)?\s*[:\-]\s*(.{3,40})/i]);
  let pcpPhone = ph(tryPat([/PCP\s*Phone\s*[:\-]?\s*([\d\s\(\)\-\.]{10,})/i]));
  let pcpEffDate = tryPat([/PCP\s*Effective\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]);
  let providerGroup = tryPat([/Provider\s*Group\s*[:\-]?\s*(.{3,40})/i]);
  let providerPhone = ph(tryPat([/Provider\s*Phone\s*[:\-]?\s*([\d\s\(\)\-\.]{10,})/i]));
  let chipNum = tryPat([/CHIP\s*Perinate\s*(?:Number)?\s*[:\-]?\s*([A-Z0-9]{3,18})/i]);

  // â”€â”€ 26. GUARDAR Y POBLAR CAMPOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fill = (id, val, isPhone=false) => setField(id, val, isPhone);

  fill('f_aseguradora',   aseg);
  fill('f_subscriberName',subscriberName);
  fill('f_memberName',    memberName);
  fill('f_memberId',      memberId);
  fill('f_subscriberId',  subscriberId);
  fill('f_groupNum',      groupNum);
  fill('f_planName',      planName);
  fill('f_planType',      planType);
  fill('f_benefitPlan',   benefitPlan);
  fill('f_effectiveDate', effectiveDate);
  fill('f_dob',           dob);
  fill('f_network',       network);
  fill('f_coverage',      coverage);
  fill('f_dependents',    dependents);
  fill('f_copayPCP',      copayPCP);
  fill('f_copaySpec',     copaySpec);
  fill('f_copayER',       copayER);
  fill('f_copayUrgent',   copayUrgent);
  fill('f_deductible',    deductible);
  fill('f_coinsurance',   coinsurance);
  fill('f_rxBin',         rxBin);
  fill('f_rxPcn',         rxPcn);
  fill('f_rxGrp',         rxGrp);
  fill('f_rxAdmin',       rxAdmin);
  fill('f_rxGeneric',     rxGeneric);
  fill('f_rxBrand',       rxBrand);
  fill('f_rxNonPref',     rxNonPref);
  fill('f_rxSpecialty',   rxSpecialty);
  fill('f_pcpName',       pcpName);
  fill('f_pcpPhone',      pcpPhone, true);
  fill('f_pcpEffDate',    pcpEffDate);
  fill('f_providerGroup', providerGroup);
  fill('f_providerPhone', providerPhone, true);
  fill('f_chipNum',       chipNum);

  State.ocr = { aseg, subscriberName, memberName, memberId, subscriberId,
    groupNum, planName, planType, benefitPlan, effectiveDate, dob, network,
    coverage, dependents, copayPCP, copaySpec, copayER, copayUrgent,
    deductible, coinsurance, rxBin, rxPcn, rxGrp, rxAdmin,
    rxGeneric, rxBrand, rxNonPref, rxSpecialty,
    pcpName, pcpPhone, pcpEffDate, providerGroup, providerPhone, chipNum };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PARSER REVERSO â€” sin lookbehind (compatible con Safari)
//  Formato BCBS TX: "1.800.521.2227" Â· "1:888-680-8046"
//  Detecta: Customer Service Â· Preauth Medical Â· Provider Service
//           Prof Network Â· Blue Card Â· MULTILIFE Â· PRIME
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function parseBack(text) {
  // â”€â”€ Normalizar separadores de telÃ©fono SIN lookbehind â”€â”€â”€â”€â”€â”€â”€â”€
  // 1.800.521.2227 â†’ 1-800-521-2227 | 1:888 â†’ 1-888
  const norm = text
    .replace(/(\d)\.(\d)/g, '$1-$2')   // puntos entre dÃ­gitos â†’ guiÃ³n
    .replace(/(\d):(\d)/g, '$1-$2');    // dos puntos entre dÃ­gitos â†’ guiÃ³n

  // â”€â”€ Helper: extraer telÃ©fono formateado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const extractPhone = (src, labelPatterns) => {
    const PNUM = '(1?[\\s\\-]?\\(?\\d{3}\\)?[\\s\\-\\.]\\d{3}[\\s\\-\\.]\\d{4})';
    for (const lbl of labelPatterns) {
      const pat = new RegExp(lbl + '[^\\n]{0,30}?' + PNUM, 'i');
      const m = src.match(pat);
      if (m) {
        const digits = m[1].replace(/\D/g,'').slice(-10);
        if (digits.length >= 10) return fmtPhone(digits);
      }
    }
    return '';
  };

  // â”€â”€ Extraer todos los telÃ©fonos del texto normalizado â”€â”€â”€â”€â”€â”€â”€â”€
  const allPhones = [];
  const normLines = norm.split(/\r?\n/);
  for (const ln of normLines) {
    const m = ln.match(/1?[\s\-]?\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/g);
    if (m) m.forEach(p => {
      const d = p.replace(/\D/g,'').slice(-10);
      if (d.length >= 10) allPhones.push({ line: ln, phone: fmtPhone(d) });
    });
  }

  // â”€â”€ Member Services (Customer Service = BCBS TX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let phone = extractPhone(norm, [
    'Customer\\s*Service',
    'Member\\s*Services?',
    'Atenci.n\\s*al',
    'Llamar\\s*a',
    'Call\\s*Us',
    'Questions?',
  ]);
  // Fallback: primer telÃ©fono del texto
  if (!phone && allPhones.length > 0) phone = allPhones[0].phone;

  // â”€â”€ Prior Authorization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let phoneAuth = extractPhone(norm, [
    'Preauth\\s*(?:Medical)?',
    'Pre\\s*Auth(?:orization)?',
    'Prior\\s*Auth(?:orization)?',
    'Precertification',
    'Authorization',
  ]);

  // â”€â”€ Pharmacy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let phonePharmacy = extractPhone(norm, ['Pharmacy','Pharmacy']);

  // â”€â”€ Nurse HelpLine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let phoneNurse = extractPhone(norm, [
    '24.?Hour\\s*Nurse',
    'Nurse\\s*(?:Help)?\\s*Line',
    'Nurse',
  ]);

  // â”€â”€ Behavioral Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let phoneBehavioral = extractPhone(norm, [
    'Behavioral\\s*Health',
    'Mental\\s*Health',
  ]);

  // â”€â”€ Provider Service / Prof Network (a notas extra) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const provSvc = extractPhone(norm, ['Provider\\s*Service','Provider\\s*Network']);
  const profNet = extractPhone(norm, ['Prof(?:essional)?\\s*Network']);
  const blueCardM = norm.match(/Blue\s*Card\s*Access[^\d]*(1[\d\s\-\.]{10,14})/i);
  const blueCard  = blueCardM ? fmtPhone(blueCardM[1].replace(/\D/g,'').slice(-10)) : '';
  const multiM = norm.match(/MULTILIFE[^\d]*(1[\d\s\-\.]{10,14})/i);
  const multi  = multiM ? fmtPhone(multiM[1].replace(/\D/g,'').slice(-10)) : '';

  const extraNotes = [];
  if (provSvc)    extraNotes.push('Provider Service: ' + provSvc);
  if (profNet)    extraNotes.push('Prof Network: '     + profNet);
  if (blueCard)   extraNotes.push('Blue Card Access: ' + blueCard);
  if (multi)      extraNotes.push('MULTILIFE: '        + multi);

  // â”€â”€ Sitio web â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let website = '';
  const webM = text.match(/(?:www\.)?([a-zA-Z0-9\-]+\.(?:com|net|org)(?:\/[A-Za-z0-9\-\/]*)?)/i);
  if (webM) website = webM[0].toLowerCase().startsWith('www.') ? webM[0] : 'www.' + webM[1];

  // â”€â”€ Pharmacy Benefits Manager en reverso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rawUp = text.toUpperCase();
  if (!v('f_rxAdmin')) {
    for (const adm of ['PRIME','Express Scripts','CVS Caremark','OptumRx','MedImpact','Navitus']) {
      if (rawUp.includes(adm.toUpperCase())) { setField('f_rxAdmin', adm, false); break; }
    }
  }

  // â”€â”€ Poblar extraInfo con datos adicionales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (extraNotes.length > 0) {
    const ei = document.getElementById('f_extraInfo');
    if (ei && !ei.value.trim()) ei.value = extraNotes.join('\n');
  }

  // â”€â”€ Poblar campos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setField('f_phone',          phone,          true);
  setField('f_phoneAuth',      phoneAuth,      false);
  setField('f_phonePharmacy',  phonePharmacy,  false);
  setField('f_phoneNurse',     phoneNurse,     false);
  setField('f_phoneBehavioral',phoneBehavioral,false);
  setField('f_websiteBack',    website,        false);

  if (phone && State.step === 2) {
    document.getElementById('phoneChipWrapper').style.display = 'block';
    document.getElementById('noPhoneNote').style.display      = 'none';
    document.getElementById('phoneChip').innerHTML            = '<span class="material-symbols-outlined">call</span> ' + phone;
  }
}




// â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setField(id, value, isPhone=false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || "";
  el.classList.remove("detected","phone-detected");
  if (value && isPhone)  el.classList.add("phone-detected");
  else if (value)        el.classList.add("detected");
}
function v(id) { return (document.getElementById(id)?.value||"").trim(); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function fmtPhone(d) {
  if (!d) return "";
  const clean = d.replace(/\D/g,"").slice(-10);
  if (clean.length<10) return d;
  return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`;
}

// â”€â”€ RESPUESTAS DEL SCRIPT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setAnswer(key, value, btn, cls) {
  btn.closest(".q-content").querySelectorAll(".ans-btn").forEach(b=>{
    b.classList.remove("sel-yes","sel-no","sel-nr");
  });
  btn.classList.add(cls);
  State.answers[key] = value;
}

// â”€â”€ EVALUACIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function evaluar(data) {
  const cobOK = ["Yes", "Partial", "Si", "Parcial"].includes(data.cobertura);
  const auth = data.autorizacion || "";
  const authOK =
    auth.includes("Obtained") || auth.includes("Obtenida") ||
    auth.includes("Not required") || auth.includes("No Requerida");
  return cobOK && authOK ? "ELIGIBLE" : "NOT ELIGIBLE";
}

// â”€â”€ SUBIR ARCHIVO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function uploadFile(file, side) {
  if (!file) return null;
  const path = `seguros/${Date.now()}_${side}_${file.name.replace(/[^\w.\-]/g, "_")}`;
  const storages =
    typeof getStorageAlternates === "function" ? getStorageAlternates() : [firebase.storage()];
  let lastErr;
  for (const st of storages) {
    try {
      const ref = st.ref().child(path);
      await ref.put(file);
      return await ref.getDownloadURL();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// â”€â”€ RECOPILAR DATOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function recopilar() {
  return {
    // Paciente
    nombre:          v("f_subscriberName") || v("f_memberName"),
    fechaNac:        v("f_dob"),
    telefono:        v("f_phone"),
    // Insurance — identification
    aseguradora:     v("f_aseguradora"),
    subscriberName:  v("f_subscriberName"),
    memberName:      v("f_memberName"),
    memberId:        v("f_memberId"),
    subscriberId:    v("f_subscriberId"),
    groupNum:        v("f_groupNum"),
    planName:        v("f_planName"),
    planType:        v("f_planType"),
    effectiveDate:   v("f_effectiveDate"),
    dob:             v("f_dob"),
    network:         v("f_network"),
    coverage:        v("f_coverage"),
    // Copagos
    copayPCP:        v("f_copayPCP"),
    copaySpec:       v("f_copaySpec"),
    copayER:         v("f_copayER"),
    copayUrgent:     v("f_copayUrgent"),
    deductible:      v("f_deductible"),
    coinsurance:     v("f_coinsurance"),
    // Pharmacy
    rxBin:           v("f_rxBin"),
    rxPcn:           v("f_rxPcn"),
    rxGrp:           v("f_rxGrp"),
    // PCP
    pcpName:         v("f_pcpName"),
    pcpPhone:        v("f_pcpPhone"),
    // Phone numbers from card back
    phoneSeguro:     v("f_phone"),
    phoneAuth:       v("f_phoneAuth"),
    website:         v("f_websiteBack"),
    // Call script answers
    cobertura:       State.answers.q1 || "",
    autorizacion:    State.answers.q2 || "",
    referencia:      State.answers.q3 || "",
    facilidad:       State.answers.q4 || "",
    facilidadDetalle:v("q4detail"),
    deducibleTotal:  v("q5ded"),
    deducibleMet:    v("q5met"),
    copago:          v("q5copago"),
    oopMax:          v("q5oop"),
    notasRep:        v("q6notes"),
    repName:         v("repName"),
    refNum:          v("refNum"),
    // Meta
    emailDestino: "michaelandresfloreshenao@gmail.com",
    fecha: new Date(),
  };
}

function submitForm() {
  _doSubmit();
}

/** Standard callable (cloudfunctions.net). In GCP, the function's Cloud Run service may need public invoker. */
async function submitVerificationReportCallable(payload) {
  await ensureCallableAuth();
  const callable = functions.httpsCallable("submitVerificationReport");
  return callable(payload);
}

/** Prefer HTTPS Storage URL — Gmail often strips large inline data: URLs from img src. */
function pickCardImageSrc(dataUrlB64, storageUrl) {
  const url = String(storageUrl || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return String(dataUrlB64 || "").trim();
}

function escapeHtmlAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function emailCardImgTag(src, alt) {
  if (!src) {
    return `<div style="width:100%;height:100px;background:#1e1e2e;border:1px dashed #334155;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">No image</div>`;
  }
  const safe = escapeHtmlAttr(src);
  return `<img src="${safe}" alt="${alt}" style="width:100%;max-width:280px;border-radius:8px;border:2px solid #2d2d3d;display:block;margin:0 auto;"/>`;
}

// -- GENERATE HTML REPORT ------------------------------------
function generateEmailHTML(data) {
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

  const imgFront = emailCardImgTag(
    pickCardImageSrc(data.b64Front, data.urlFrente),
    "Front of card"
  );
  const imgBack = emailCardImgTag(
    pickCardImageSrc(data.b64Back, data.urlReverso),
    "Back of card"
  );

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MedAuth Pro — Insurance Verification Report</title></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;min-height:100vh;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:#16162a;border:1px solid #2d2d3d;border-radius:16px;overflow:hidden;">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px 36px;text-align:center;">
  <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;color:rgba(255,255,255,0.7);margin-bottom:8px;">MedAuth Pro</div>
  <div style="font-size:26px;font-weight:800;color:#fff;margin:0 0 6px;letter-spacing:-.02em;">Medical Insurance Verification</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.75);">Bariatric Surgery · Verification report</div>
</td></tr>

<tr><td style="padding:28px 36px;">

<!-- CARD IMAGES -->
<div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;margin-bottom:28px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:${azul};margin-bottom:16px;border-bottom:1px solid #2d2d3d;padding-bottom:10px;">
    💳 Insurance Card — Captured Images
  </div>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" style="padding-right:8px;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${morado};letter-spacing:.1em;margin-bottom:8px;">🪪 Front</div>
      ${imgFront}
    </td>
    <td width="50%" style="padding-left:8px;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#06b6d4;letter-spacing:.1em;margin-bottom:8px;">🔄 Back</div>
      ${imgBack}
    </td>
  </tr></table>
</div>

<!-- INSURANCE IDENTIFICATION -->
<div style="margin-bottom:24px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:${morado};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">🪪 Insurance Identification</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
    ${fila("Patient",             data.nombre,        "#e2e8f0")}
    ${fila("Insurance Company",   data.aseguradora,   "#c4b5fd")}
    ${fila("Subscriber Name",     data.subscriberName)}
    ${fila("Member Name",         data.memberName)}
    ${fila("Member ID / ID #",    data.memberId,      "#93c5fd")}
    ${fila("Subscriber ID",       data.subscriberId)}
    ${fila("Group Number",        data.groupNum,      "#93c5fd")}
    ${fila("Plan Name",           data.planName)}
    ${fila("Plan Type",           data.planType)}
    ${fila("Effective Date",      data.effectiveDate)}
    ${fila("Date of Birth (DOB)", data.dob)}
    ${fila("Network",             data.network)}
    ${fila("Type of Coverage",    data.coverage)}
  </table>
</div>

<!-- COPAYS -->
<div style="margin-bottom:24px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#06b6d4;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">💊 Copays &amp; Medical Costs</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
    ${fila("PCP / Primary Care Copay", data.copayPCP)}
    ${fila("Specialist Copay",         data.copaySpec)}
    ${fila("Emergency Room (ER)",      data.copayER)}
    ${fila("Urgent Care",              data.copayUrgent)}
    ${fila("Deductible (Med/Rx)",      data.deductible)}
    ${fila("Coinsurance",              data.coinsurance)}
  </table>
</div>

<!-- PHARMACY -->
${data.rxBin||data.rxPcn||data.rxGrp ? `
<div style="margin-bottom:24px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:${azul};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">💊 Pharmacy Plan</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
    ${fila("RxBIN", data.rxBin)}
    ${fila("RxPCN", data.rxPcn)}
    ${fila("RxGRP", data.rxGrp)}
  </table>
</div>` : ""}

<!-- CONTACTS -->
<div style="margin-bottom:24px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2d2d3d;">📞 Contacts &amp; PCP</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #2d2d3d;border-radius:8px;overflow:hidden;">
    ${fila("Member Services Phone", data.phoneSeguro,   "#6ee7b7")}
    ${fila("Prior Auth Phone",      data.phoneAuth)}
    ${fila("PCP Name",              data.pcpName)}
    ${fila("PCP Phone",             data.pcpPhone)}
    ${fila("Website",               data.website)}
  </table>
</div>

<!-- VERIFICATION SCRIPT -->
<div style="margin-bottom:24px;background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;">
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2d2d3d;">📋 Verification Call Results</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${fila("1. Covered?",                 data.cobertura,      "")}
    ${fila("2. Prior Authorization?",     data.autorizacion,   "")}
    ${fila("3. PCP Referral?",            data.referencia)}
    ${fila("4. Specific Facility?",       data.facilidad)}
    ${data.facilidadDetalle ? fila("   Facility Detail", data.facilidadDetalle) : ""}
    ${fila("5. Total Deductible (call)",  data.deducibleTotal)}
    ${fila("   Deductible Met",           data.deducibleMet)}
    ${fila("   Copay/Coinsurance (call)", data.copago)}
    ${fila("   Out-of-Pocket Max.",       data.oopMax)}
    ${fila("Insurance Rep.",              data.repName)}
    ${fila("Reference Number",            data.refNum)}
  </table>
  ${data.notasRep ? `
  <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid #2d2d3d;">
    <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Additional Notes</div>
    <div style="font-size:14px;color:#cbd5e1;line-height:1.6;">${data.notasRep}</div>
  </div>` : ""}
</div>

<!-- RECORD META -->
<div style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:16px;">
  <div style="font-size:11px;color:#a78bfa;font-weight:600;">
    📁 Record ID: <code style="font-family:monospace;color:#c4b5fd;">${f(data.expedienteId)}</code>
  </div>
  <div style="font-size:11px;color:#64748b;margin-top:4px;">
    Date: ${new Date().toLocaleString("en-US", {timeZone:"America/Bogota"})}
  </div>
</div>

</td></tr>

<!-- FOOTER -->
<tr><td style="background:#0d0d1f;padding:20px 36px;text-align:center;border-top:1px solid #2d2d3d;">
  <p style="font-size:12px;color:#475569;margin:0;line-height:1.6;">
    This report was automatically generated by <strong style="color:#7c3aed;">MedAuth Pro</strong><br/>
    Sent to: <a href="mailto:michaelandresfloreshenao@gmail.com" style="color:#7c3aed;text-decoration:none;">michaelandresfloreshenao@gmail.com</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function _doSubmit() {
  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.innerHTML = "<span class='material-symbols-outlined'>hourglass_empty</span> Processing...";
  const [ss, ok, er] = [
    document.getElementById("statusSending"),
    document.getElementById("statusSuccess"),
    document.getElementById("statusError"),
  ];
  ss.classList.add("visible");
  ok.classList.remove("visible");
  er.classList.remove("visible");

  try {
    // Storage rules often require auth; without sign-in the POST fails and the browser may show "CORS".
    await ensureCallableAuth();
    ss.querySelector("span:last-child").textContent = "Uploading card images...";
    let urlFront = "";
    let urlBack = "";
    try {
      [urlFront, urlBack] = await Promise.all([
        uploadFile(State.files.front, "front"),
        uploadFile(State.files.back,  "back"),
      ]);
    } catch (uploadErr) {
      console.warn("Storage upload failed (report email still includes embedded images):", uploadErr);
      ss.querySelector("span:last-child").textContent =
        "Storage unavailable — sending report with embedded images...";
      await new Promise((r) => setTimeout(r, 600));
    }

    const data = recopilar();
    data.urlFrente  = urlFront || "";
    data.urlReverso = urlBack  || "";
    data.b64Front   = State.b64.front || "";
    data.b64Back    = State.b64.back  || "";
    data.resultado  = evaluar(data);

    ss.querySelector("span:last-child").textContent = "Saving record...";
    const docRef = await firebase.firestore().collection("pacientes").add(
      Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("b64")))
    );
    data.expedienteId = docRef.id;

    // -- Send report via Firebase callable function --
    ss.querySelector("span:last-child").textContent = "Sending report by cloud function...";
    const subject = `MedAuth Pro — ${data.nombre || "Patient"} — Insurance verification`;
    const textBody =
      `Patient: ${data.nombre || "—"}\n` +
      `Member ID: ${data.memberId || "—"}\n` +
      `Group #: ${data.groupNum || "—"}\n` +
      `Script summary (automated): ${data.resultado || "—"}`;

    // Omit base64 blobs from callable payload — HTML already embeds images; halves request size.
    const reportForCallable = Object.fromEntries(
      Object.entries(data).filter(([k]) => !k.startsWith("b64"))
    );

    await submitVerificationReportCallable({
      subject,
      text: textBody,
      html_report: generateEmailHTML(data),
      report: reportForCallable,
    });

    ss.classList.remove("visible");
    ok.classList.add("visible");
    setTimeout(() => showResultado(data.resultado, data), 1500);

  } catch (err) {
    console.error(err);
    ss.classList.remove("visible");
    er.classList.add("visible");
    document.getElementById("errorMsg").textContent = "Error: " + (err.message || "Please try again.");
    btn.disabled = false;
    btn.innerHTML = "<span class='material-symbols-outlined'>send</span> Evaluate &amp; Send Report";
  }
}

// â”€â”€ RESULTADO FINAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showResultado(resultado, data) {
  document.getElementById("progressWrapper").style.display="none";
  document.getElementById("step-2").classList.remove("active");
  document.getElementById("step-3").classList.add("active");

  const rc=document.getElementById("resultCard");
  rc.className="section-card result-card result-apto";

  const row=(label,val,accent=false)=>`
    <div class="summary-row">
      <span class="summary-key">${label}</span>
      <span class="summary-val${accent?" summary-accent":""}">${val||"—"}</span>
    </div>`;
  const chip=(val,good)=>`
    <span class="chip ${good?"chip-si":"chip-no"}">${good?"<span class='material-symbols-outlined'>check_circle</span>":"<span class='material-symbols-outlined'>cancel</span>"} ${val||"—"}</span>`;

  rc.innerHTML=`
    <div class="result-icon-wrapper"><span class="material-symbols-outlined">mark_email_read</span></div>
    <div class="result-badge"><span class="material-symbols-outlined">check_circle</span> Report sent</div>
    <p class="result-message">
      Verification report for <strong>${data.nombre || "Patient"}</strong> was saved and emailed to <strong>michaelandresfloreshenao@gmail.com</strong>.
    </p>

    ${pickCardImageSrc(data.b64Front, data.urlFrente) || pickCardImageSrc(data.b64Back, data.urlReverso) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
      ${pickCardImageSrc(data.b64Front, data.urlFrente) ? `<div>
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:0 0 6px;">Front</p>
        <img src="${escapeHtmlAttr(pickCardImageSrc(data.b64Front, data.urlFrente))}" style="width:100%;border-radius:8px;border:1px solid var(--border);" alt="Card front"/>
      </div>`:"<div></div>"}
      ${pickCardImageSrc(data.b64Back, data.urlReverso) ? `<div>
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin:0 0 6px;">Back</p>
        <img src="${escapeHtmlAttr(pickCardImageSrc(data.b64Back, data.urlReverso))}" style="width:100%;border-radius:8px;border:1px solid var(--border);" alt="Card back"/>
      </div>`:"<div></div>"}
    </div>`:""}

    <div class="summary-table">
      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--primary-light);margin:0 0 8px;">Insurance identification</p>
      ${row("Insurance Company", data.aseguradora)}
      ${row("Subscriber Name", data.subscriberName)}
      ${row("Member Name", data.memberName)}
      ${row("Member ID", data.memberId, true)}
      ${row("Subscriber ID", data.subscriberId)}
      ${row("Group Number", data.groupNum, true)}
      ${row("Plan", data.planName)}
      ${row("Plan Type", data.planType)}
      ${row("Effective Date", data.effectiveDate)}
      ${row("Network", data.network)}

      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:14px 0 8px;">Copays and Costs</p>
      ${row("PCP Copay", data.copayPCP)}
      ${row("Specialist Copay", data.copaySpec)}
      ${row("ER Copay", data.copayER)}
      ${row("Urgent Care", data.copayUrgent)}
      ${row("Deductible", data.deductible)}
      ${row("Coinsurance", data.coinsurance)}

      ${data.rxBin||data.rxPcn?`<p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--secondary);margin:14px 0 8px;">Pharmacy</p>`:``}
      ${row("RxBIN", data.rxBin)}
      ${row("RxPCN", data.rxPcn)}
      ${row("RxGroup", data.rxGrp)}

      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--text-muted);margin:14px 0 8px;">Verification call results</p>
      <div class="summary-row"><span class="summary-key">Covered?</span>${chip(data.cobertura,["Yes","Partial","Si","Parcial"].includes(data.cobertura))}</div>
      <div class="summary-row"><span class="summary-key">Prior authorization</span>${chip(data.autorizacion,(a=>a&&(a.includes("Obtained")||a.includes("Obtenida")||a.includes("Not required")||a.includes("No Requerida")))(data.autorizacion))}</div>
      ${row("Deductible (call)", data.deducibleTotal)}
      ${row("Deductible met", data.deducibleMet)}
      ${row("Copay/Coinsurance (call)", data.copago)}
      ${row("Out-of-pocket max.", data.oopMax)}
      ${row("Insurance Rep", data.repName)}
      ${row("Reference #", data.refNum)}
      ${data.notasRep?`<div class="summary-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="summary-key">Additional notes</span><span class="summary-val" style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${data.notasRep}</span></div>`:""}
      ${row("Record ID", `<span style="font-family:monospace;font-size:11px;">${data.expedienteId||"—"}</span>`)}
    </div>

    <div style="margin-top:18px;padding:14px 18px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-sm);text-align:center;">
      <p style="font-size:13px;color:#34d399;margin:0;">Report sent automatically to <strong>michaelandresfloreshenao@gmail.com</strong></p>
    </div>
    <button class="btn btn-secondary" style="margin-top:18px;" onclick="resetAll()">+ Evaluate New Patient</button>
  `;

  window.scrollTo({top:0,behavior:"smooth"});
}

// â”€â”€ RESET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function resetAll() {
  State.step=1;
  State.files={front:null,back:null};
  State.urls={front:null,back:null};
  State.b64={front:null,back:null};
  State.ocr={};
  State.answers={q1:null,q2:null,q3:null,q4:null};
  document.querySelectorAll("input,textarea").forEach(e=>{if(e.type!=="file")e.value="";});
  document.querySelectorAll(".ans-btn").forEach(b=>b.classList.remove("sel-yes","sel-no","sel-nr"));
  ["Front","Back"].forEach(s=>{
    document.getElementById(`drop${s}`).style.display="flex";
    document.getElementById(`cap${s}`).classList.remove("visible");
    document.getElementById(`ocr${s}Panel`).classList.remove("visible");
    document.getElementById(`ocr${s}Fill`).style.width="0%";
    document.getElementById(`file${s}`).value="";
  });
  document.getElementById("extractedSection").style.display="none";
  document.getElementById("ocrToggleSection").style.display="none";
  document.getElementById("progressWrapper").style.display="block";
  document.getElementById("phoneChipWrapper").style.display="none";
  document.getElementById("noPhoneNote").style.display="block";
  document.querySelectorAll(".form-section").forEach(s=>s.classList.remove("active"));
  document.getElementById("step-1").classList.add("active");
  updateProgress(1);
  window.scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("DOMContentLoaded",()=>{
  updateProgress(1);
  console.log("MedAuth Pro — OCR module ready");
});

// â”€â”€ UI TOGGLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.toggleOCRData = function() {
  const sec = document.getElementById("extractedSection");
  const icon = document.getElementById("ocrToggleIcon");
  if (sec.style.display === "none") {
    sec.style.display = "block";
    icon.innerHTML = "Hide data <span class='material-symbols-outlined'>expand_less</span>";
  } else {
    sec.style.display = "none";
    icon.innerHTML = "View extracted data <span class='material-symbols-outlined'>expand_more</span>";
  }
};

