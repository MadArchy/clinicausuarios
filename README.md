# MedAuth Pro — Patient insurance verification

Automated eligibility workflow for procedures covered by medical insurance.
Evaluates **ELIGIBLE / NOT ELIGIBLE** (legacy records may still show **APTO / NO APTO**) and sends an automated email to `michaelandresfloreshenao@gmail.com`.

---

## Already configured

- Firebase project: `datosdelpaciente-8e3ba`
- Email destination: `michaelandresfloreshenao@gmail.com`
- OCR with Tesseract.js (reads text from insurance card photos)
- Automatic eligibility evaluation
- Polished UI for clinic staff

---

## Steps to go live

### Step 1 — Enable Firestore and Storage

1. Open https://console.firebase.google.com/project/datosdelpaciente-8e3ba
2. **Firestore Database** → Create database → production mode
3. **Storage** → Get started

---

### Step 2 — Gmail app password

> Do not use your normal Gmail password. You need an **app password**.

1. https://myaccount.google.com/security
2. Turn on **2-Step Verification** if it is off
3. https://myaccount.google.com/apppasswords
4. Choose **Mail** and **Other** → name it `MedAuth`
5. Copy the 16-character password Google shows

---

### Step 3 — Firebase CLI (if needed)

```powershell
npm install -g firebase-tools
firebase login
```

---

### Step 4 — Email credentials

```powershell
cd path\to\clinicausuarios

cd functions
npm install
cd ..

firebase functions:config:set gmail.user="michaelandresfloreshenao@gmail.com" gmail.password="YOUR_16_CHAR_APP_PASSWORD"
```

---

### Step 5 — Deploy

```powershell
firebase deploy
```

You should get a URL similar to:

```
✓ Hosting URL: https://datosdelpaciente-8e3ba.web.app
```

---

### Step 6 — Local testing (optional)

Open `index.html` in the browser. Without deployed Cloud Functions, the email step may not run, but the form and OCR still work in the browser.

---

## How OCR works

1. User uploads an **insurance card photo** (JPG, PNG, WEBP).
2. **Tesseract.js** runs in the browser.
3. The app tries to detect **Member ID**, **Group**, **insurer name**, and related fields from common US card layouts.
4. Form fields are filled automatically; staff should verify and correct as needed.

> OCR works best with **sharp**, well-lit, high-resolution photos.

---

## Eligibility logic (summary)

```
ELIGIBLE when:
  - Surgery covered (Yes or Partial)
  - Prior authorization obtained, or not required

NOT ELIGIBLE when:
  - Surgery not covered
  - Prior authorization required but not obtained
```

(Network rules in the README snippet above were illustrative; the live rules are implemented in `js/app.js`.)

---

## Automated email

When a record is saved, an email goes to `michaelandresfloreshenao@gmail.com` with patient and insurance details, verification answers, and embedded card images when available.

---

## Project layout

```
clinicausuarios/
├── index.html
├── css/styles.css
├── js/app.js
├── js/firebase-config.js
├── functions/index.js
├── functions/package.json
├── firestore.rules
├── storage.rules
├── firebase.json
└── .firebaserc
```

---

## Troubleshooting

### Data does not save to Firebase

- Confirm Firestore is enabled in the console
- Review `firestore.rules`

### Email never arrives

- Confirm the Gmail app password in `firebase functions:config`
- Check logs: `firebase functions:log`

### OCR misses fields

- Use sharp, well-lit images
- PDF uploads are not supported (image files only)
- Card text can be English or Spanish; the OCR language pack includes both
