const fs = require('fs');

// 1. Add Material Symbols link to index.html
let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('Material+Symbols+Outlined')) {
  html = html.replace('</head>', '  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />\n</head>');
}

// 2. Add alignment CSS to styles.css
let css = fs.readFileSync('css/styles.css', 'utf8');
if (!css.includes('.material-symbols-outlined')) {
  css += '\n.material-symbols-outlined { vertical-align: bottom; font-size: inherit; line-height: 1; }\n';
  fs.writeFileSync('css/styles.css', css);
}

// 3. Map emojis to Material Symbols
const map = {
  '💳': '<span class="material-symbols-outlined">credit_card</span>',
  '🪪': '<span class="material-symbols-outlined">badge</span>',
  '🖼️': '<span class="material-symbols-outlined">image</span>',
  '🤖': '<span class="material-symbols-outlined">document_scanner</span>',
  '🔄': '<span class="material-symbols-outlined">sync</span>',
  '📋': '<span class="material-symbols-outlined">fact_check</span>',
  '📞': '<span class="material-symbols-outlined">call</span>',
  '🔍': '<span class="material-symbols-outlined">search</span>',
  '☝️': '<span class="material-symbols-outlined">info</span>',
  '✅': '<span class="material-symbols-outlined">check_circle</span>',
  '⬇️': '<span class="material-symbols-outlined">expand_more</span>',
  '⬆️': '<span class="material-symbols-outlined">expand_less</span>',
  '✕': '<span class="material-symbols-outlined">close</span>',
  '🏥': '<span class="material-symbols-outlined">local_hospital</span>',
  '💊': '<span class="material-symbols-outlined">medication</span>',
  '🩺': '<span class="material-symbols-outlined">stethoscope</span>',
  '📝': '<span class=\"material-symbols-outlined\">edit_note</span>',
  '🗣️': '<span class="material-symbols-outlined">record_voice_over</span>',
  '⏳': '<span class="material-symbols-outlined">hourglass_empty</span>',
  '🚀': '<span class="material-symbols-outlined">send</span>',
  '⚠️': '<span class="material-symbols-outlined">warning</span>',
  '🎉': '<span class="material-symbols-outlined">celebration</span>',
  '❌': '<span class="material-symbols-outlined">cancel</span>'
};

const replaceAll = (text) => {
  let out = text;
  for (const [emo, icon] of Object.entries(map)) {
    out = out.split(emo).join(icon);
  }
  return out;
};

// Replace in HTML
html = replaceAll(html);
html = html.replace('?v=5', '?v=6');
fs.writeFileSync('index.html', html);

// Replace in JS
let js = fs.readFileSync('js/app.js', 'utf8');
js = replaceAll(js);
fs.writeFileSync('js/app.js', js);
console.log('Icons upgraded successfully!');
