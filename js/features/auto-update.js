(function () {
    const TOASTED = new Set();
    let lastStatus = '';

    function getUpdater() {
        return window.electronAPI && window.electronAPI.updates ? window.electronAPI.updates : null;
    }

    function toastOnce(key, message, type) {
        if (TOASTED.has(key)) return;
        TOASTED.add(key);
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    function ensurePanel() {
        let panel = document.getElementById('cg-update-panel');
        if (panel) return panel;

        panel = document.createElement('aside');
        panel.id = 'cg-update-panel';
        panel.className = 'cg-update-panel is-hidden';
        panel.innerHTML = `
            <div class="cg-update-icon"><i data-lucide="download-cloud" class="w-5 h-5"></i></div>
            <div class="cg-update-copy">
                <strong id="cg-update-title">Atualizacao do CredGestor</strong>
                <span id="cg-update-detail">Verificando versao...</span>
                <div class="cg-update-progress" aria-hidden="true">
                    <span id="cg-update-progress-bar"></span>
                </div>
            </div>
            <div class="cg-update-actions">
                <button type="button" id="cg-update-primary" class="cg-update-primary">Instalar</button>
                <button type="button" id="cg-update-dismiss" class="cg-update-secondary" title="Ocultar">Depois</button>
            </div>
        `;
        document.body.appendChild(panel);

        const dismiss = panel.querySelector('#cg-update-dismiss');
        const primary = panel.querySelector('#cg-update-primary');
        dismiss.addEventListener('click', () => panel.classList.add('is-hidden'));
        primary.addEventListener('click', async () => {
            const updater = getUpdater();
            if (!updater) return;
            primary.disabled = true;
            primary.textContent = 'Aguarde...';
            const result = await updater.install();
            if (!result || !result.success) {
                primary.disabled = false;
                primary.textContent = 'Instalar';
                if (typeof window.showToast === 'function') {
                    window.showToast(result?.error || 'Atualizacao ainda nao esta pronta.', 'warning');
                }
            }
        });

        if (typeof lucide !== 'undefined' && typeof window.refreshIcons === 'function') {
            window.refreshIcons();
        }
        return panel;
    }

    function setPanel(status, title, detail, percent, installReady) {
        const panel = ensurePanel();
        const titleEl = panel.querySelector('#cg-update-title');
        const detailEl = panel.querySelector('#cg-update-detail');
        const progressEl = panel.querySelector('#cg-update-progress-bar');
        const primary = panel.querySelector('#cg-update-primary');

        panel.dataset.status = status || 'idle';
        titleEl.textContent = title;
        detailEl.textContent = detail;
        progressEl.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
        primary.disabled = !installReady;
        primary.textContent = installReady ? 'Reiniciar' : 'Baixando';
        panel.classList.remove('is-hidden');
    }

    function handleStatus(payload = {}) {
        const status = payload.status || 'idle';
        const version = payload.latestVersion || payload.updateInfo?.version || '';
        const percent = Number(payload.percent || 0);

        if (!payload.enabled || status === 'disabled' || status === 'idle') {
            const panel = document.getElementById('cg-update-panel');
            if (panel && status !== lastStatus) panel.classList.add('is-hidden');
            lastStatus = status;
            return;
        }

        if (status === 'available') {
            toastOnce(`available-${version}`, `Nova versao ${version || ''} encontrada. Download iniciado.`, 'info');
            setPanel(status, 'Nova versao encontrada', `Baixando CredGestor ${version || 'mais recente'}...`, 4, false);
        } else if (status === 'downloading') {
            setPanel(status, 'Baixando atualizacao', `${Math.round(percent)}% concluido`, percent, false);
        } else if (status === 'downloaded') {
            toastOnce(`downloaded-${version}`, 'Atualizacao pronta. Reinicie para instalar.', 'success');
            setPanel(status, 'Atualizacao pronta', `Versao ${version || 'mais recente'} pronta para instalar.`, 100, true);
        } else if (status === 'installing') {
            setPanel(status, 'Instalando atualizacao', 'O CredGestor sera reiniciado automaticamente.', 100, false);
        } else if (status === 'error') {
            console.warn('[CredGestor Update]', payload.error || 'Falha ao verificar atualizacao.');
            const panel = document.getElementById('cg-update-panel');
            if (panel) panel.classList.add('is-hidden');
        }

        lastStatus = status;
    }

    async function checkNow() {
        const updater = getUpdater();
        if (!updater) {
            if (typeof window.showToast === 'function') window.showToast('Atualizacao disponivel apenas no app desktop.', 'warning');
            return { success: false };
        }
        toastOnce(`manual-check-${Date.now()}`, 'Verificando atualizacao...', 'info');
        return updater.check();
    }

    window.verificarAtualizacoes = checkNow;

    document.addEventListener('DOMContentLoaded', async () => {
        const updater = getUpdater();
        if (!updater) return;
        updater.onStatus(handleStatus);
        try {
            const status = await updater.getStatus();
            handleStatus(status);
        } catch (error) {
            console.warn('[CredGestor Update] Falha ao ler status inicial:', error);
        }
    });
})();
