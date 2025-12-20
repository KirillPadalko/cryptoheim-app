// Modal functionality for Google Play button
document.addEventListener('DOMContentLoaded', () => {
    const playStoreBtn = document.querySelector('.btn-store:not(.btn-apk)');
    const apkBtn = document.querySelector('.btn-apk');
    const modal = document.getElementById('playStoreModal');
    const closeBtn = document.getElementById('closeModal');

    // Open modal when Google Play button is clicked
    if (playStoreBtn) {
        playStoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        });
    }

    // Download APK when APK button is clicked
    if (apkBtn) {
        apkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Path to your APK file - update this path when you add the APK file
            const apkPath = './src/assets/cryptoheim.apk';

            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = apkPath;
            link.download = 'CryptoHeim.apk';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Close modal when close button is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Close modal when clicking outside the modal content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});
