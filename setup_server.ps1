# ============================================================
# SCRIPT DE CONFIGURACIÓN DEL SERVIDOR USUFRUA (RTX Pro 6000)
# Ejecuta este script en PowerShell local
# ============================================================

$SERVER_IP   = "47.184.25.55"
$SERVER_PORT = "2224"
$SERVER_USER = "raicube"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  USUFRUA SERVER - SETUP GUIDE" -ForegroundColor Cyan
Write-Host "  RTX Pro 6000 | Ollama + LLaMA 3.1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── FASE 1: VERIFICAR CONEXION SSH ──────────────────────────
Write-Host "[FASE 1] Probando conexión SSH..." -ForegroundColor Yellow
Write-Host "Conectando a ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}" -ForegroundColor Gray
Write-Host ""
Write-Host "Comando a ejecutar:" -ForegroundColor White
Write-Host "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA: La primera vez te pedirá:" -ForegroundColor Yellow
Write-Host "  1. Confirmar el fingerprint del host → escribe: yes" -ForegroundColor White
Write-Host "  2. La contraseña: jack@555" -ForegroundColor White
Write-Host ""

$respuesta = Read-Host "¿Quieres conectarte ahora? (s/n)"
if ($respuesta -eq "s") {
    Write-Host ""
    Write-Host "Abriendo conexión SSH..." -ForegroundColor Green
    ssh -p $SERVER_PORT "${SERVER_USER}@${SERVER_IP}"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMANDOS PARA EJECUTAR EN EL SERVIDOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[PASO 1] Cambiar contraseña (OBLIGATORIO):" -ForegroundColor Yellow
Write-Host "  passwd" -ForegroundColor Green

Write-Host ""
Write-Host "[PASO 2] Verificar GPU RTX Pro 6000:" -ForegroundColor Yellow
Write-Host "  nvidia-smi" -ForegroundColor Green

Write-Host ""
Write-Host "[PASO 3] Actualizar el sistema:" -ForegroundColor Yellow
Write-Host "  sudo apt update && sudo apt upgrade -y" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FASE 2 — INSTALAR OLLAMA" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[PASO 4] Instalar Ollama:" -ForegroundColor Yellow
Write-Host "  curl -fsSL https://ollama.com/install.sh | sh" -ForegroundColor Green

Write-Host ""
Write-Host "[PASO 5] Verificar instalación:" -ForegroundColor Yellow
Write-Host "  ollama --version" -ForegroundColor Green
Write-Host "  systemctl status ollama" -ForegroundColor Green

Write-Host ""
Write-Host "[PASO 6] Descargar modelos (con RTX Pro 6000 / 48GB VRAM):" -ForegroundColor Yellow
Write-Host "  # Modelo más potente (recomendado):" -ForegroundColor Gray
Write-Host "  ollama pull llama3.1:70b" -ForegroundColor Green
Write-Host ""
Write-Host "  # Modelo para código:" -ForegroundColor Gray
Write-Host "  ollama pull codellama:34b" -ForegroundColor Green
Write-Host ""
Write-Host "  # Modelo rápido y liviano:" -ForegroundColor Gray
Write-Host "  ollama pull mistral:7b" -ForegroundColor Green

Write-Host ""
Write-Host "[PASO 7] Configurar Ollama para red:" -ForegroundColor Yellow
Write-Host "  sudo systemctl edit ollama" -ForegroundColor Green
Write-Host "  # Agregar dentro de [Service]:" -ForegroundColor Gray
Write-Host '  Environment="OLLAMA_HOST=0.0.0.0"' -ForegroundColor Green
Write-Host "  sudo systemctl daemon-reload" -ForegroundColor Green
Write-Host "  sudo systemctl restart ollama" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FASE 3 — TUNEL SSH SEGURO PARA CURSOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[PASO 8] Crear túnel SSH (ejecutar en tu PC local):" -ForegroundColor Yellow
Write-Host "  ssh -p $SERVER_PORT -L 11434:localhost:11434 -N ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Green
Write-Host ""
Write-Host "  Este túnel redirige el puerto 11434 del servidor a tu localhost." -ForegroundColor Gray

Write-Host ""
Write-Host "[PASO 9] Configurar Cursor IDE:" -ForegroundColor Yellow
Write-Host "  Settings → Models → Add Custom Provider" -ForegroundColor White
Write-Host "  URL: http://localhost:11434/v1" -ForegroundColor Green
Write-Host "  Model: llama3.1:70b" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  LISTO! Arquitectura final:" -ForegroundColor Green
Write-Host "  Tu PC (Cursor) → SSH Tunnel → RTX Pro 6000 → LLaMA 3.1:70b" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
