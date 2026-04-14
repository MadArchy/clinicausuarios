/* ============================================================
   APP.JS — OCR multi-formato para tarjetas de seguro médico
   Soporta: Ambetter, Amerigroup, BlueCross, Christus, Molina
   y cualquier otro asegurador común de Texas/USA
   ============================================================ */
"use strict";

// ── ESTADO GLOBAL ──────────────────────────────────────────────
const State = {
  step: 1,
  files:   { front: null, back: null },
  urls:    { front: null, back: null },
  b64:     { front: null, back: null },        // base64 para el email
  ocr:     {},                                  // datos crudos extraídos
  answers: { q1:null, q2:null, q3:null, q4:null },
  autorizacionFinal: null,                      // decisión del modal
};

const STEP_LABELS = [
  { label:"Datos del Paciente y Tarjeta del Seguro", pct:33  },
  { label:"Script de Llamada al Seguro",             pct:66  },
  { label:"Resultado Final",                         pct:100 },
];

// ── NAVEGACIÓN ─────────────────────────────────────────────────
function updateProgress(step) {
  const c = STEP_LABELS[step-1];
  document.getElementById("progressFill").style.width  = c.pct+"%";
  document.getElementById("progressLabel").textContent = `Paso ${step} de 3`;
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

// ── MANEJO DE ARCHIVOS ─────────────────────────────────────────
function handleCard(side, event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith("image/")) {
    alert("⚠️ Solo se permiten imágenes (JPG, PNG, WEBP, HEIC).");
    return;
  }
  State.files[side] = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    State.b64[side] = dataUrl;   // guardar para el email

    // Mostrar vista previa
    document.getElementById(`drop${cap(side)}`).style.display = "none";
    const cap_el = document.getElementById(`cap${cap(side)}`);
    cap_el.classList.add("visible");
    document.getElementById(`img${cap(side)}`).src = dataUrl;

    // Mostrar botón de toggle
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

// ── OCR ────────────────────────────────────────────────────────
async function runOCR(side, dataUrl) {
  const panel = document.getElementById(`ocr${cap(side)}Panel`);
  const fill  = document.getElementById(`ocr${cap(side)}Fill`);
  const label = document.getElementById(`ocr${cap(side)}Label`);
  panel.classList.add("visible");
  label.textContent = side==="front" ? "Analizando frente de la tarjeta..." : "Analizando reverso...";
  fill.style.width = "5%";
  try {
    const worker = await Tesseract.createWorker("eng+spa", 1, {
      logger: m => {
        if (m.status === "recognizing text") {
          fill.style.width = Math.round(m.progress*100)+"%";
          label.textContent = `Extrayendo datos... ${Math.round(m.progress*100)}%`;
        }
      },
    });
    const { data: { text } } = await worker.recognize(dataUrl);
    await worker.terminate();
    fill.style.width  = "100%";
    label.innerHTML = "<span class='material-symbols-outlined'>check_circle</span> Información extraída correctamente";
    // Mostrar texto crudo
    const rawBlock = document.getElementById("ocrRawBlock");
    const rawArea  = document.getElementById("ocrRawText");
    if (rawBlock && rawArea) {
      rawBlock.style.display = "block";
      rawArea.value = (rawArea.value ? rawArea.value + "\n\n── REVERSO ──\n" : "") + text.trim();
      if (side==="front") rawArea.value = text.trim();
      else rawArea.value = rawArea.value + (rawArea.value ? "\n\n── REVERSO ──\n" : "") + text.trim();
    }
    if (side==="front") parseFront(text);
    else                parseBack(text);
  } catch(err) {
    label.innerHTML = "<span class='material-symbols-outlined'>warning</span> Error de lectura — completa los datos manualmente";
    console.error("OCR error:", err);
  }
}

// ══════════════════════════════════════════════════════════════
//  PARSER FRENTE — robusto, multi-formato, tolerante a ruido OCR
//  Soporta: Ambetter · Amerigroup · BlueCross/TX · Christus · Molina
// ══════════════════════════════════════════════════════════════
function parseFront(text) {

  // ── 1. PREPROCESADO ──────────────────────────────────────────
  // a) Líneas limpias (quitamos ruido OCR: ><=|~`@#^*)
  const lines = text.split(/\r?\n/)
    .map(l => l.replace(/[><|~`@#\^*\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // b) Texto colapsado en una sola línea (útil para patrones multi-línea)
  const collapsed = lines.join(' ');

  // c) Versión uppercase para comparaciones rápidas
  const T = collapsed.toUpperCase();

  // ── 2. HELPERS ───────────────────────────────────────────────

  // Prueba patrones en collapsed y raw; devuelve primer match
  const tryPat = (patterns) => {
    for (const p of patterns) {
      const m = collapsed.match(p) || text.match(p);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    return '';
  };

  // Busca valor JUSTO después de una etiqueta (misma línea o siguiente línea)
  const afterLabel = (keywords) => {
    const kwArr = Array.isArray(keywords) ? keywords : [keywords];
    for (const kw of kwArr) {
      const ku = kw.toUpperCase();
      // 1. Intentar en collapsed
      const idx = T.indexOf(ku);
      if (idx !== -1) {
        const after = collapsed.slice(idx + kw.length).replace(/^\s*[:\-=]?\s*/, '').trim();
        const tok = after.split(/\s{2,}|\n/)[0].trim(); // hasta doble espacio o línea nueva
        if (tok && tok.length >= 2) {
          return tok.replace(/\s+\d$/, '').trim(); // quitar dígito suelto al final (ruido OCR)
        }
      }
      // 2. Intentar línea a línea: etiqueta en línea N, valor en línea N o N+1
      for (let i = 0; i < lines.length; i++) {
        const lu = lines[i].toUpperCase();
        const pos = lu.indexOf(ku);
        if (pos === -1) continue;
        // Valor en la misma línea (texto después del keyword + separador)
        const rest = lines[i].slice(pos + kw.length).replace(/^\s*[:\-=]?\s*/, '').trim();
        if (rest.length >= 2 && !/^[\d\s]*$/.test(rest) === false || /[A-Z0-9]{2}/.test(rest)) {
          return rest.replace(/\s+\d$/, '').trim();
        }
        // Valor en la siguiente línea no vacía
        for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
          if (lines[j] && lines[j].trim().length >= 2) {
            return lines[j].trim();
          }
        }
      }
    }
    return '';
  };

  // Extrae primer número de teléfono formateado
  const ph = (s) => {
    if (!s) return '';
    const d = s.replace(/\D/g, '').slice(-10);
    return d.length >= 10 ? fmtPhone(d) : '';
  };

  // ── 3. ASEGURADORA ───────────────────────────────────────────
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

  // ── 4. SUBSCRIBER NAME ───────────────────────────────────────
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

  // ── 5. MEMBER NAME ───────────────────────────────────────────
  // Detectar nombre completo en mayúsculas (típico en tarjetas)
  let memberName = tryPat([
    /Member\s*(?:Name)?\s*[:\-]?\s*([A-Z][A-Za-z\.\s\-']{3,40})/i,
    /Insured\s*[:\-]\s*([A-Z][A-Za-z\.\s\-']{3,40})/i,
  ]);
  // Fallback: buscar línea que sea nombre (APELLIDO, Nombre · ej: JUAN J. VASQUEZ)
  if (!memberName) {
    for (const ln of lines) {
      if (/^[A-Z]{2,}(?:\s+[A-Z]\.?\s*)?[A-Z]{2,}$/.test(ln.trim())) {
        memberName = ln.trim(); break;
      }
    }
  }
  if (!memberName && subscriberName) memberName = subscriberName;

  // Si subscriber Name está vacío, usar memberName
  if (!subscriberName && memberName) subscriberName = memberName;

  // ── 6. MEMBER ID ─────────────────────────────────────────────
  let memberId = tryPat([
    /Identification\s*Number\s*[:\-]?\s*([A-Z]{0,4}\d{6,14}[A-Z0-9]*)/i,
    /Member\s*ID\s*[:\-#]?\s*([A-Z0-9]{5,20})/i,
    /MBR\s*ID\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /Member\s*Number\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /ID\s*#\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /\b([A-Z]{1,3}\d{7,14})\b/,   // ZGP829810078 — patrón genérico
    /\b(\d{8,14})\b/,
  ]);

  // ── 7. SUBSCRIBER ID ─────────────────────────────────────────
  let subscriberId = tryPat([
    /Subscriber\s*(?:ID|#|Number)\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
    /CHIP\s*Perinate\s*(?:Number|#)?\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
  ]);
  if (subscriberId === memberId) subscriberId = '';

  // ── 8. GROUP NUMBER ──────────────────────────────────────────
  let groupNum = tryPat([
    /Group\s*(?:No\.?|Number|Num|#)\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /GRP\s*#?\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
  ]);

  // ── 9. PLAN NAME ─────────────────────────────────────────────
  // Detectar nombre del plan (ej: BCA FAMILY, Balanced Care 1, etc.)
  let planName = tryPat([
    /Plan\s*[:\-]\s*(.{4,60})/i,
  ]);
  // Fallback: buscar líneas con palabras clave de plan
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

  // ── 10. PLAN TYPE ────────────────────────────────────────────
  let planType = '';
  for (const pt of ['PPO','HMO','EPO','POS','HDHP','HSA','MAPD','TDI','CHIP','HIOPT','QHF','PCP']) {
    if (new RegExp('\\b'+pt+'\\b').test(T)) { planType = pt; break; }
  }

  // ── 11. BENEFIT PLAN CODE ────────────────────────────────────
  let benefitPlan = tryPat([/Benefit\s*Plan\s+([A-Z0-9]{2,12})/i]);

  // ── 12. EFFECTIVE DATE ───────────────────────────────────────
  let effectiveDate = tryPat([
    /Coverage\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Member\s*Effective\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Effective\s*Date\s*(?:of\s*Coverage)?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Eff\.?\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // ── 13. DATE OF BIRTH ────────────────────────────────────────
  let dob = tryPat([
    /(?:Date\s*of\s*Birth|DOB)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // ── 14. NETWORK ──────────────────────────────────────────────
  let network = '';
  if (T.includes('IN NETWORK COVERAGE ONLY')) network = 'In Network Coverage Only';
  else if (T.includes('IN-NETWORK'))           network = 'In Network';
  else if (T.includes('IN NETWORK'))           network = 'In Network';
  else if (T.includes('OUT OF NETWORK'))       network = 'Out of Network';

  // ── 15. TYPE OF COVERAGE ─────────────────────────────────────
  let coverage = tryPat([/Type\s*(?:of)?\s*Coverage\s*[:\-]?\s*(\w[\w\s\-]{0,30})/i]);
  // BCBS TX: Detectar "BCA FAMILY TDI TX-EX" etc.
  if (!coverage) {
    if (T.includes('CHIP'))     coverage = 'CHIP';
    else if (T.includes('TDI')) coverage = 'TDI';
  }

  // ── 16. DEPENDENTS ───────────────────────────────────────────
  let dependents = '';
  const depLines = collapsed.match(/Dependent\s+(?:One|Two|Three|Four|\d+)|Member\s+\d+/gi);
  if (depLines) dependents = depLines.join(' · ');
  // Buscar "Pediatric Dental" como indicador de cobertura de dependientes
  if (!dependents && T.includes('PEDIATRIC DENTAL')) dependents = 'Pediatric Dental (under 19)';

  // ── 17. COPAGOS ──────────────────────────────────────────────
  let copayPCP = '', copaySpec = '', copayER = '', copayUrgent = '';

  // BCBS TX: "OV/Spec $40/80" → PCP=$40, Specialist=$80
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

  // ── 18. DEDUCTIBLE ───────────────────────────────────────────
  let deductible = tryPat([
    /Deductible\s*(?:\(Med\/?Rx\))?\s*[:\-]?\s*(\$[\d,.]+)/i,
    /Deductible\s+(\$[\d,.]+)/i,
  ]);

  // ── 19. COINSURANCE ──────────────────────────────────────────
  let coinsurance = tryPat([
    /Coinsurance\s*(?:\(Med\/?Rx\))?\s*[:\-]?\s*(\d+%)/i,
    /Co[- ]?insurance\s+(\d+%)/i,
  ]);

  // ── 20. RxBIN ────────────────────────────────────────────────
  let rxBin = tryPat([
    /RxBIN\s*[:\-]?\s*(\d{4,10})/i,
    /Rx\s*BIN\s*#?\s*[:\-]?\s*(\d{4,10})/i,
    /BIN\s*[:\-]?\s*(\d{4,10})/i,
  ]);

  // ── 21. RxPCN ────────────────────────────────────────────────
  let rxPcn = tryPat([
    /RxPCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
    /Rx\s*PCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
    /PCN\s*[:\-]?\s*([A-Z0-9]{2,12})/i,
  ]);

  // ── 22. RxGRP ────────────────────────────────────────────────
  let rxGrp = tryPat([
    /RxGRP\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /Rx\s*GR(?:P|OUP)\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
    /Rx\s*Group\s*[:\-]?\s*([A-Z0-9]{2,14})/i,
  ]);

  // ── 23. PHARMACY ADMINISTRATOR ───────────────────────────────
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

  // ── 24. DRUG TIERS ───────────────────────────────────────────
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

  // ── 25. PCP / PROVIDER ───────────────────────────────────────
  let pcpName = tryPat([/PCP\s*(?:Name)?\s*[:\-]\s*(.{3,40})/i]);
  let pcpPhone = ph(tryPat([/PCP\s*Phone\s*[:\-]?\s*([\d\s\(\)\-\.]{10,})/i]));
  let pcpEffDate = tryPat([/PCP\s*Effective\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]);
  let providerGroup = tryPat([/Provider\s*Group\s*[:\-]?\s*(.{3,40})/i]);
  let providerPhone = ph(tryPat([/Provider\s*Phone\s*[:\-]?\s*([\d\s\(\)\-\.]{10,})/i]));
  let chipNum = tryPat([/CHIP\s*Perinate\s*(?:Number)?\s*[:\-]?\s*([A-Z0-9]{3,18})/i]);

  // ── 26. GUARDAR Y POBLAR CAMPOS ──────────────────────────────
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

// ══════════════════════════════════════════════════════════════
//  PARSER REVERSO — sin lookbehind (compatible con Safari)
//  Formato BCBS TX: "1.800.521.2227" · "1:888-680-8046"
//  Detecta: Customer Service · Preauth Medical · Provider Service
//           Prof Network · Blue Card · MULTILIFE · PRIME
// ══════════════════════════════════════════════════════════════
function parseBack(text) {
  // ── Normalizar separadores de teléfono SIN lookbehind ────────
  // 1.800.521.2227 → 1-800-521-2227 | 1:888 → 1-888
  const norm = text
    .replace(/(\d)\.(\d)/g, '$1-$2')   // puntos entre dígitos → guión
    .replace(/(\d):(\d)/g, '$1-$2');    // dos puntos entre dígitos → guión

  // ── Helper: extraer teléfono formateado ──────────────────────
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

  // ── Extraer todos los teléfonos del texto normalizado ────────
  const allPhones = [];
  const normLines = norm.split(/\r?\n/);
  for (const ln of normLines) {
    const m = ln.match(/1?[\s\-]?\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/g);
    if (m) m.forEach(p => {
      const d = p.replace(/\D/g,'').slice(-10);
      if (d.length >= 10) allPhones.push({ line: ln, phone: fmtPhone(d) });
    });
  }

  // ── Member Services (Customer Service = BCBS TX) ─────────────
  let phone = extractPhone(norm, [
    'Customer\\s*Service',
    'Member\\s*Services?',
    'Atenci.n\\s*al',
    'Llamar\\s*a',
    'Call\\s*Us',
    'Questions?',
  ]);
  // Fallback: primer teléfono del texto
  if (!phone && allPhones.length > 0) phone = allPhones[0].phone;

  // ── Prior Authorization ───────────────────────────────────────
  let phoneAuth = extractPhone(norm, [
    'Preauth\\s*(?:Medical)?',
    'Pre\\s*Auth(?:orization)?',
    'Prior\\s*Auth(?:orization)?',
    'Precertification',
    'Authorization',
  ]);

  // ── Pharmacy ─────────────────────────────────────────────────
  let phonePharmacy = extractPhone(norm, ['Pharmacy','Farmacia']);

  // ── Nurse HelpLine ───────────────────────────────────────────
  let phoneNurse = extractPhone(norm, [
    '24.?Hour\\s*Nurse',
    'Nurse\\s*(?:Help)?\\s*Line',
    'Nurse',
  ]);

  // ── Behavioral Health ────────────────────────────────────────
  let phoneBehavioral = extractPhone(norm, [
    'Behavioral\\s*Health',
    'Mental\\s*Health',
  ]);

  // ── Provider Service / Prof Network (a notas extra) ──────────
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

  // ── Sitio web ────────────────────────────────────────────────
  let website = '';
  const webM = text.match(/(?:www\.)?([a-zA-Z0-9\-]+\.(?:com|net|org)(?:\/[A-Za-z0-9\-\/]*)?)/i);
  if (webM) website = webM[0].toLowerCase().startsWith('www.') ? webM[0] : 'www.' + webM[1];

  // ── Pharmacy Benefits Manager en reverso ─────────────────────
  const rawUp = text.toUpperCase();
  if (!v('f_rxAdmin')) {
    for (const adm of ['PRIME','Express Scripts','CVS Caremark','OptumRx','MedImpact','Navitus']) {
      if (rawUp.includes(adm.toUpperCase())) { setField('f_rxAdmin', adm, false); break; }
    }
  }

  // ── Poblar extraInfo con datos adicionales ────────────────────
  if (extraNotes.length > 0) {
    const ei = document.getElementById('f_extraInfo');
    if (ei && !ei.value.trim()) ei.value = extraNotes.join('\n');
  }

  // ── Poblar campos ────────────────────────────────────────────
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




// ── HELPERS ────────────────────────────────────────────────────
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

// ── RESPUESTAS DEL SCRIPT ──────────────────────────────────────
function setAnswer(key, value, btn, cls) {
  btn.closest(".q-content").querySelectorAll(".ans-btn").forEach(b=>{
    b.classList.remove("sel-yes","sel-no","sel-nr");
  });
  btn.classList.add(cls);
  State.answers[key] = value;
}

// ── EVALUACIÓN ─────────────────────────────────────────────────
function evaluar(data) {
  const cobOK  = ["Si","Parcial"].includes(data.cobertura);
  const authOK = data.autorizacion &&
    (data.autorizacion.includes("Obtenida")||data.autorizacion.includes("No Requerida"));
  return (cobOK && authOK) ? "APTO" : "NO APTO";
}

// ── SUBIR ARCHIVO ─────────────────────────────────────────────
async function uploadFile(file, side) {
  if (!file) return null;
  const ref = firebase.storage().ref()
    .child(`seguros/${Date.now()}_${side}_${file.name.replace(/[^\w.\-]/g,"_")}`);
  await ref.put(file);
  return await ref.getDownloadURL();
}

// ── RECOPILAR DATOS ────────────────────────────────────────────
function recopilar() {
  return {
    // Paciente
    nombre:          v("f_subscriberName") || v("f_memberName"),
    fechaNac:        v("f_dob"),
    telefono:        v("f_phone"),
    // Seguro — Identificación
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
    // Farmacia
    rxBin:           v("f_rxBin"),
    rxPcn:           v("f_rxPcn"),
    rxGrp:           v("f_rxGrp"),
    // PCP
    pcpName:         v("f_pcpName"),
    pcpPhone:        v("f_pcpPhone"),
    // Teléfono del reverso
    phoneSeguro:     v("f_phone"),
    phoneAuth:       v("f_phoneAuth"),
    website:         v("f_websiteBack"),
    // Script de llamada
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
    // Decisión de autorización final
    autorizacionFinal: State.autorizacionFinal || "",
    // Meta
    emailDestino: "michaelandresfloreshenao@gmail.com",
    fecha: new Date(),
  };
}

// ── MODAL DE AUTORIZACIÓN ──────────────────────────────────────
function submitForm() {
  // Mostrar el modal de decisión antes de proceder
  document.getElementById('authModal').classList.add('visible');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('visible');
}

function confirmarAutorizacion(decision) {
  State.autorizacionFinal = decision; // "AUTORIZADO" o "NO AUTORIZADO"
  closeAuthModal();
  _doSubmit();
}

async function _doSubmit() {
  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.innerHTML = "<span class='material-symbols-outlined'>hourglass_empty</span> Procesando...";
  const [ss, ok, er] = [
    document.getElementById("statusSending"),
    document.getElementById("statusSuccess"),
    document.getElementById("statusError"),
  ];
  ss.classList.add("visible");
  ok.classList.remove("visible");
  er.classList.remove("visible");

  try {
    ss.querySelector("span:last-child").textContent = "Subiendo imágenes de la tarjeta...";
    const [urlFront, urlBack] = await Promise.all([
      uploadFile(State.files.front, "frente"),
      uploadFile(State.files.back, "reverso"),
    ]);

    const data = recopilar();
    data.urlFrente  = urlFront || "";
    data.urlReverso = urlBack  || "";
    data.b64Front   = State.b64.front || "";
    data.b64Back    = State.b64.back  || "";
    data.resultado  = evaluar(data);

    ss.querySelector("span:last-child").textContent = "Guardando expediente...";
    const docRef = await firebase.firestore().collection("pacientes").add(
      Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("b64")))
    );
    data.expedienteId = docRef.id;

    // Disparar email
    await firebase.firestore().collection("emailQueue").add({
      ...data,
      b64Front: data.b64Front,
      b64Back:  data.b64Back,
      expedienteId: data.expedienteId,
      createdAt: new Date(),
    });

    ss.classList.remove("visible");
    ok.classList.add("visible");
    setTimeout(() => showResultado(data.resultado, data), 1500);
  } catch (err) {
    console.error(err);
    ss.classList.remove("visible");
    er.classList.add("visible");
    document.getElementById("errorMsg").textContent = "Error: " + (err.message || "Intenta de nuevo.");
    btn.disabled = false;
    btn.innerHTML = "<span class='material-symbols-outlined'>send</span> Evaluar y Enviar Informe";
  }
}

// ── RESULTADO FINAL ────────────────────────────────────────────
function showResultado(resultado, data) {
  const esApto = resultado==="APTO";
  document.getElementById("progressWrapper").style.display="none";
  document.getElementById("step-2").classList.remove("active");
  document.getElementById("step-3").classList.add("active");

  const rc=document.getElementById("resultCard");
  rc.className=`section-card result-card ${esApto?"result-apto":"result-noApto"}`;

  const row=(label,val,accent=false)=>`
    <div class="summary-row">
      <span class="summary-key">${label}</span>
      <span class="summary-val${accent?" summary-accent":""}">${val||"—"}</span>
    </div>`;
  const chip=(val,good)=>`
    <span class="chip ${good?"chip-si":"chip-no"}">${good?"<span class='material-symbols-outlined'>check_circle</span>":"<span class='material-symbols-outlined'>cancel</span>"} ${val||"—"}</span>`;

  rc.innerHTML=`
    <div class="result-icon-wrapper">${esApto?"<span class='material-symbols-outlined'>celebration</span>":"<span class='material-symbols-outlined'>warning</span>"}</div>
    <div class="result-badge">${esApto?"<span class='material-symbols-outlined'>check_circle</span> APTO":"<span class='material-symbols-outlined'>cancel</span> NO APTO"}</div>
    <p class="result-message">
      ${esApto
        ?`<strong>${data.nombre}</strong> cumple los criterios de elegibilidad para cirugía bariátrica.`
        :`<strong>${data.nombre}</strong> NO cumple todos los criterios en este momento.`}
    </p>

    ${data.b64Front||data.b64Back?`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
      ${data.b64Front?`<div>
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:0 0 6px;">Frente</p>
        <img src="${data.b64Front}" style="width:100%;border-radius:8px;border:1px solid var(--border);" alt="Frente tarjeta"/>
      </div>`:"<div></div>"}
      ${data.b64Back?`<div>
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin:0 0 6px;">Reverso</p>
        <img src="${data.b64Back}" style="width:100%;border-radius:8px;border:1px solid var(--border);" alt="Reverso tarjeta"/>
      </div>`:"<div></div>"}
    </div>`:""}

    <div class="summary-table">
      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--primary-light);margin:0 0 8px;">Identificación del Seguro</p>
      ${row("Aseguradora", data.aseguradora)}
      ${row("Subscriber Name", data.subscriberName)}
      ${row("Member Name", data.memberName)}
      ${row("Member ID", data.memberId, true)}
      ${row("Subscriber ID", data.subscriberId)}
      ${row("Group Number", data.groupNum, true)}
      ${row("Plan", data.planName)}
      ${row("Tipo de Plan", data.planType)}
      ${row("Effective Date", data.effectiveDate)}
      ${row("Red", data.network)}

      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:14px 0 8px;">Copagos y Costos</p>
      ${row("Copago PCP", data.copayPCP)}
      ${row("Copago Especialista", data.copaySpec)}
      ${row("Copago ER", data.copayER)}
      ${row("Urgent Care", data.copayUrgent)}
      ${row("Deducible", data.deductible)}
      ${row("Coinsurance", data.coinsurance)}

      ${data.rxBin||data.rxPcn?`<p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--secondary);margin:14px 0 8px;">Farmacia</p>`:``}
      ${row("RxBIN", data.rxBin)}
      ${row("RxPCN", data.rxPcn)}
      ${row("RxGroup", data.rxGrp)}

      <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--text-muted);margin:14px 0 8px;">Resultado de la Verificación</p>
      <div class="summary-row"><span class="summary-key">¿Cubierta?</span>${chip(data.cobertura,["Si","Parcial"].includes(data.cobertura))}</div>
      <div class="summary-row"><span class="summary-key">Autorización</span>${chip(data.autorizacion,data.autorizacion?.includes("Obtenida")||data.autorizacion?.includes("No Requerida"))}</div>
      ${row("Deducible total (llamada)", data.deducibleTotal)}
      ${row("Deducible cumplido", data.deducibleMet)}
      ${row("Copago/Coseguro (llamada)", data.copago)}
      ${row("Out-of-Pocket Máx.", data.oopMax)}
      ${row("Rep del seguro", data.repName)}
      ${row("Referencia #", data.refNum)}
      ${data.notasRep?`<div class="summary-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span class="summary-key">Notas adicionales</span><span class="summary-val" style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${data.notasRep}</span></div>`:""}
      ${row("ID Expediente", `<span style="font-family:monospace;font-size:11px;">${data.expedienteId||"—"}</span>`)}
    </div>

    <div style="margin-top:18px;padding:14px 18px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-sm);text-align:center;">
      <p style="font-size:13px;color:#34d399;margin:0;">📧 Informe enviado automáticamente a <strong>michaelandresfloreshenao@gmail.com</strong></p>
    </div>
    <button class="btn btn-secondary" style="margin-top:18px;" onclick="resetAll()">+ Evaluar Nuevo Paciente</button>
  `;

  window.scrollTo({top:0,behavior:"smooth"});
  if (esApto) confetti();
}

// ── RESET ──────────────────────────────────────────────────────
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

// ── CONFETTI ───────────────────────────────────────────────────
function confetti() {
  const c=document.getElementById("confettiContainer");
  const cols=["#0077ce","#10b981","#3b82f6","#f59e0b","#ec4899","#06b6d4"];
  for(let i=0;i<80;i++){
    const p=document.createElement("div"); p.className="confetti-piece";
    p.style.cssText=`left:${Math.random()*100}%;top:-10px;background:${cols[Math.floor(Math.random()*cols.length)]};animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*1.5}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>.5?"50%":"2px"};`;
    c.appendChild(p);
  }
  setTimeout(()=>c.innerHTML="",6000);
}

document.addEventListener("DOMContentLoaded",()=>{
  updateProgress(1);
  console.log("✅ MedAuth Pro — motor OCR multi-formato cargado");
});

// ── UI TOGGLER ─────────────────────────────────────────────────
window.toggleOCRData = function() {
  const sec = document.getElementById("extractedSection");
  const icon = document.getElementById("ocrToggleIcon");
  if (sec.style.display === "none") {
    sec.style.display = "block";
    icon.innerHTML = "Ocultar datos <span class='material-symbols-outlined'>expand_less</span>";
  } else {
    sec.style.display = "none";
    icon.innerHTML = "Ver datos extraídos <span class='material-symbols-outlined'>expand_more</span>";
  }
};
