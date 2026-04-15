const fs = require('fs');
let js = fs.readFileSync('js/app.js', 'utf8');

// Fix 1: textContent assigning HTML → change to innerHTML
// Line 58: phoneChip textContent
js = js.replace(
  `document.getElementById('phoneChip').textContent = '<span class='material-symbols-outlined'>call</span> ' + phone;`,
  `document.getElementById('phoneChip').innerHTML = '<span class=\"material-symbols-outlined\">call</span> ' + phone;`
);
// Line 649: phoneChip textContent (duplicate)
js = js.replace(
  `document.getElementById('phoneChip').textContent          = '<span class='material-symbols-outlined'>call</span> ' + phone;`,
  `document.getElementById('phoneChip').innerHTML            = '<span class=\"material-symbols-outlined\">call</span> ' + phone;`
);

// Fix 2: label.textContent with HTML → innerHTML
js = js.replace(
  `label.textContent = "<span class='material-symbols-outlined'>check_circle</span> Información extraída correctamente"`,
  `label.innerHTML = "<span class='material-symbols-outlined'>check_circle</span> Información extraída correctamente"`
);
js = js.replace(
  `label.textContent = "<span class='material-symbols-outlined'>warning</span> Error de lectura — completa los datos manualmente"`,
  `label.innerHTML = "<span class='material-symbols-outlined'>warning</span> Error de lectura — completa los datos manualmente"`
);

// Fix 3: alert() calls — strip HTML from alert text
js = js.replace(
  `alert("<span class='material-symbols-outlined'>warning</span> Solo se permiten imágenes (JPG, PNG, WEBP, HEIC).")`,
  `alert("⚠️ Solo se permiten imágenes (JPG, PNG, WEBP, HEIC).")`
);
js = js.replace(
  `\`alert("<span class='material-symbols-outlined'>warning</span> Responde la pregunta 1: ¿Está cubierta?")`,
  ``  // handled below
);
// Use a regex approach for alert() with icons
js = js.replace(/alert\("(<span class='material-symbols-outlined'>warning<\/span>) ([^"]+)"\)/g, 'alert("⚠️ $2")');

// Fix 4: btn.disabled / btn.textContent with HTML → btn.innerHTML
js = js.replace(
  `btn.disabled=true; btn.textContent="<span class='material-symbols-outlined'>hourglass_empty</span> Procesando..."`,
  `btn.disabled=true; btn.innerHTML="<span class='material-symbols-outlined'>hourglass_empty</span> Procesando..."`
);
js = js.replace(
  `btn.disabled=false; btn.textContent="<span class='material-symbols-outlined'>send</span> Evaluar y Enviar Informe"`,
  `btn.disabled=false; btn.innerHTML="<span class='material-symbols-outlined'>send</span> Evaluar y Enviar Informe"`
);

// Fix 5: console.log strip icons
js = js.replace(
  `console.log("<span class='material-symbols-outlined'>check_circle</span> MedAuth Pro — motor OCR multi-formato cargado")`,
  `console.log("✅ MedAuth Pro — motor OCR multi-formato cargado")`
);

fs.writeFileSync('js/app.js', js);
console.log('Done patching!');
