#!/bin/bash
# ============================================================
# SERVIDOR USUFRUA — SCRIPT DE CONFIGURACIÓN COMPLETA
# RTX Pro 6000 | Ubuntu | Ollama + LLaMA 3.1:70b
# Copia y pega este script completo en el servidor
# ============================================================

set -e  # Detener si hay error

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   USUFRUA SERVER SETUP — RTX Pro 6000   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── PASO 1: VERIFICAR SISTEMA ─────────────────────────────
echo "▶ [1/7] Verificando sistema..."
echo "   OS: $(lsb_release -d 2>/dev/null || cat /etc/os-release | head -1)"
echo "   CPU: $(nproc) cores"
echo "   RAM: $(free -h | awk '/^Mem:/{print $2}')"
echo "   Disk: $(df -h / | awk 'NR==2{print $4}') libre"
echo ""

# ── PASO 2: VERIFICAR GPU ─────────────────────────────────
echo "▶ [2/7] Verificando GPU RTX Pro 6000..."
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    echo "   ✅ GPU detectada correctamente"
else
    echo "   ⚠️  nvidia-smi no encontrado. Verifica los drivers NVIDIA."
fi
echo ""

# ── PASO 3: ACTUALIZAR SISTEMA ────────────────────────────
echo "▶ [3/7] Actualizando sistema..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo "   ✅ Sistema actualizado"
echo ""

# ── PASO 4: INSTALAR OLLAMA ──────────────────────────────
echo "▶ [4/7] Instalando Ollama..."
if command -v ollama &> /dev/null; then
    echo "   ℹ️  Ollama ya está instalado: $(ollama --version)"
else
    curl -fsSL https://ollama.com/install.sh | sh
    echo "   ✅ Ollama instalado"
fi
echo ""

# ── PASO 5: CONFIGURAR OLLAMA (acceso de red) ────────────
echo "▶ [5/7] Configurando Ollama para acceso en red..."

# Crear/editar el override del servicio systemd
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_NUM_PARALLEL=4"
EOF

sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl restart ollama
sleep 3

# Verificar que está corriendo
if systemctl is-active --quiet ollama; then
    echo "   ✅ Ollama activo y escuchando en 0.0.0.0:11434"
else
    echo "   ❌ Error iniciando Ollama. Revisa: journalctl -u ollama -n 50"
fi
echo ""

# ── PASO 6: DESCARGAR MODELOS ────────────────────────────
echo "▶ [6/7] Descargando modelos de IA..."
echo "   ℹ️  Con 48GB VRAM puedes usar LLaMA 3.1:70b"
echo ""

# Descargar modelo rápido primero para probar
echo "   → Descargando mistral:7b (rápido, para prueba inicial)..."
ollama pull mistral:7b

echo ""
echo "   → Descargando codellama:34b (especializado en código)..."
ollama pull codellama:34b

echo ""
echo "   → Descargando llama3.1:70b (el más potente, ~40GB)..."
echo "   ⏳ Esto puede tomar 20-40 minutos..."
ollama pull llama3.1:70b

echo ""
echo "   ✅ Modelos instalados:"
ollama list
echo ""

# ── PASO 7: PRUEBA FINAL ─────────────────────────────────
echo "▶ [7/7] Prueba de funcionamiento..."
echo "   Enviando pregunta de prueba a mistral:7b..."
ollama run mistral:7b "Di 'Hola, soy Ollama corriendo en RTX Pro 6000' en una sola línea." --nowordwrap 2>/dev/null | head -3
echo ""

# ── RESUMEN FINAL ─────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║           CONFIGURACIÓN COMPLETA         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "✅ Ollama API disponible en: http://$(hostname -I | awk '{print $1}'):11434"
echo ""
echo "━━━ PARA CONECTAR DESDE TU PC LOCAL ━━━━━━━━"
echo ""
echo "  [Túnel SSH seguro - recomendado]"
echo "  ssh -p 2224 -L 11434:localhost:11434 -N raicube@47.184.25.55"
echo ""
echo "  [En Cursor IDE → Settings → Models]"
echo "  Base URL: http://localhost:11434/v1"
echo "  Model:    llama3.1:70b"
echo ""
echo "  [Probar la API directamente]"
echo "  curl http://localhost:11434/api/tags"
echo ""
echo "━━━ ARQUITECTURA FINAL ━━━━━━━━━━━━━━━━━━━━"
echo "  Tu PC (Cursor) → SSH Tunnel → RTX Pro 6000"
echo "  → Ollama → llama3.1:70b (privado, sin límites)"
echo ""
