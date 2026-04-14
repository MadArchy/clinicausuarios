# 🏥 MedAuth Pro — Sistema de Evaluación de Pacientes

Sistema automatizado de elegibilidad para cirugías cubiertas por seguro médico.
Evalúa **APTO / NO APTO** y envía email automático a `michaelandresfloreshenao@gmail.com`.

---

## ✅ Lo que ya está configurado

- ✅ Firebase Project: `datosdelpaciente-8e3ba`
- ✅ Email destino: `michaelandresfloreshenao@gmail.com`
- ✅ OCR con Tesseract.js (lee texto de imágenes de tarjetas de seguro)
- ✅ Evaluación automática APTO / NO APTO
- ✅ Diseño premium dark mode

---

## 🚀 PASOS PARA PONER EN PRODUCCIÓN

### PASO 1 — Habilitar Firestore y Storage en Firebase

1. Ir a → https://console.firebase.google.com/project/datosdelpaciente-8e3ba
2. **Firestore Database** → "Crear base de datos" → Modo producción
3. **Storage** → "Comenzar"

---

### PASO 2 — Configurar App Password de Gmail

> ⚠️ NO uses tu contraseña normal de Gmail. Necesitas una **App Password**.

1. Ve a → https://myaccount.google.com/security
2. Habilita la **Verificación en 2 pasos** si no la tienes
3. Ve a → https://myaccount.google.com/apppasswords
4. Selecciona `Correo` y `Otro dispositivo` → nombra "MedAuth"
5. Copia la contraseña de 16 caracteres que genera Google

---

### PASO 3 — Instalar Firebase CLI (si no lo tienes)

```powershell
npm install -g firebase-tools
firebase login
```

---

### PASO 4 — Configurar credenciales del email

```powershell
# Navegar a la carpeta del proyecto
cd "c:\Users\user\Desktop\formulario  para  envio de  datos del paciente"

# Instalar dependencias de Functions
cd functions
npm install
cd ..

# Configurar credenciales de Gmail (reemplaza con tu App Password exacta)
firebase functions:config:set gmail.user="michaelandresfloreshenao@gmail.com" gmail.password="AQUI_TU_APP_PASSWORD_16_CHARS"
```

---

### PASO 5 — Desplegar en Firebase

```powershell
# Desplegar todo (hosting + functions + rules)
firebase deploy
```

Cuando termine, obtendrás una URL como:
```
✓ Hosting URL: https://datosdelpaciente-8e3ba.web.app
```

---

### PASO 6 — Probar localmente (opcional)

Simplemente abre el archivo `index.html` en tu navegador.
> Sin Firebase Functions en local, el email NO se enviará, pero el formulario y OCR funcionan completamente.

---

## 📸 ¿Cómo funciona el OCR?

1. Usuario sube una **foto de la tarjeta del seguro** (JPG, PNG, WEBP)
2. **Tesseract.js** (IA de reconocimiento de texto) lee la imagen en el navegador
3. El sistema detecta automáticamente:
   - **Member ID** — busca patrones como `ID: XXXX`, `MEMBER ID XXXX`
   - **Group Number** — busca patrones como `GROUP: XXXX`, `GRP XXXX`
   - **Aseguradora** — detecta nombres como Blue Cross, Aetna, Cigna, etc.
4. Completa los campos del formulario automáticamente
5. El agente verifica y corrige cualquier dato incorrecto

> 💡 El OCR funciona mejor con **fotos nítidas**, bien iluminadas y en buena resolución.

---

## 🧠 Lógica de Evaluación APTO / NO APTO

```
APTO si:
  ✅ Cirugía cubierta (Sí o Parcial)
  ✅ Autorización previa (Sí o No requerida)  
  ✅ Dentro de la red (In-Network)

NO APTO si:
  ❌ Cirugía NO cubierta
  ❌ Requiere autorización pero NO fue obtenida
  ❌ Fuera de la red (Out-of-Network)
```

---

## 📧 Email automático

Cuando se guarda un paciente, **automáticamente** se envía un email a `michaelandresfloreshenao@gmail.com` con:

- 🏷️ Asunto: `🏥 Paciente APTO/NO APTO — [Nombre] | [Aseguradora]`
- 👤 Datos completos del paciente
- 🏦 Información del seguro (Member ID, Group, Plan)
- ✅ Resultado de la verificación de cobertura
- 💰 Información financiera (deducible, copago)
- 📎 Enlace al documento subido

---

## 🗂️ Estructura del Proyecto

```
formulario-paciente/
├── index.html              ← Formulario principal
├── css/
│   └── styles.css          ← Diseño premium dark mode
├── js/
│   ├── app.js              ← Lógica + OCR + Firebase
│   └── firebase-config.js  ← Configuración Firebase
├── functions/
│   ├── index.js            ← Cloud Function email (Nodemailer)
│   └── package.json
├── firestore.rules         ← Reglas de seguridad
├── storage.rules           ← Reglas de almacenamiento
├── firebase.json
└── .firebaserc
```

---

## ⚠️ Resolución de Problemas

### El formulario no guarda en Firebase
- Verifica que Firestore esté habilitado en la consola
- Revisa las reglas de `firestore.rules`

### El email no llega
- Verifica que la App Password de Gmail esté correcta
- Revisa los logs: `firebase functions:log`
- Asegúrate que less secure app access no interfiera

### El OCR no detecta nada
- Usa imágenes nítidas, bien iluminadas
- Evita PDFs (solo funciona con imágenes JPG/PNG)
- El texto del seguro debe estar en inglés o español
