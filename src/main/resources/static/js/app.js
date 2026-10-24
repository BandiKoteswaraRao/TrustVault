// TrustVault Security SaaS UI Script

document.addEventListener('DOMContentLoaded', function () {
    // 1. Copy Hash to Clipboard
    document.querySelectorAll('.copy-hash').forEach(function (button) {
        button.addEventListener('click', function () {
            const hashText = this.getAttribute('data-hash');
            if (hashText) {
                navigator.clipboard.writeText(hashText).then(function () {
                    const originalText = button.innerHTML;
                    button.innerHTML = '<span class="text-emerald-400">Copied!</span>';
                    setTimeout(() => {
                        button.innerHTML = originalText;
                    }, 1800);
                }).catch(function (err) {
                    console.error('Clipboard copy failed:', err);
                });
            }
        });
    });

    // 2. Quick-fill Demo Account Credentials on Login Page
    window.fillCredentials = function (username, password) {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (usernameInput && passwordInput) {
            usernameInput.value = username;
            passwordInput.value = password;
            // Visual pulse effect
            usernameInput.classList.add('ring-2', 'ring-cyan-500');
            passwordInput.classList.add('ring-2', 'ring-cyan-500');
            setTimeout(() => {
                usernameInput.classList.remove('ring-2', 'ring-cyan-500');
                passwordInput.classList.remove('ring-2', 'ring-cyan-500');
            }, 600);
        }
    };

    // 3. Dropzone File Upload Feedback
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (dropzone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                updateFileDisplay();
            }
        });

        fileInput.addEventListener('change', updateFileDisplay);

        function updateFileDisplay() {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const sizeKb = (file.size / 1024).toFixed(1);
                if (fileNameDisplay) {
                    fileNameDisplay.innerHTML = `
                        <div class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 border border-blue-500/50 rounded-lg text-blue-200 text-sm font-medium">
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span>${file.name}</span>
                            <span class="text-xs text-blue-300 font-mono">(${sizeKb} KB)</span>
                        </div>
                    `;
                }
            }
        }
    }
});
