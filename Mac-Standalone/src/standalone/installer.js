const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class StandaloneInstaller {
    constructor() {
        this.resourcesPath = process.resourcesPath;
        this.dockerImagesPath = path.join(this.resourcesPath, 'docker-images');
        this.installedFlagPath = path.join(app.getPath('userData'), '.standalone-installed');
    }

    async checkAndInstall() {
        // Check if already installed
        if (fs.existsSync(this.installedFlagPath)) {
            console.log('Standalone images already installed');
            return true;
        }

        // Check if docker-images directory exists
        if (!fs.existsSync(this.dockerImagesPath)) {
            console.log('Not a standalone build, skipping image installation');
            return true;
        }

        // Show installation dialog
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'First Time Setup',
            message: 'This appears to be the first time running Web Appliance Dashboard.\n\nThe app needs to install Docker images for offline operation. This may take a few minutes.',
            buttons: ['Install Now', 'Cancel'],
            defaultId: 0
        });

        if (result.response !== 0) {
            return false;
        }

        // Install images
        return await this.installImages();
    }

    async installImages() {
        return new Promise((resolve, reject) => {
            const installer = spawn('bash', ['install-offline.sh'], {
                cwd: this.dockerImagesPath,
                env: process.env
            });

            installer.stdout.on('data', (data) => {
                console.log(`Installer: ${data}`);
            });

            installer.stderr.on('data', (data) => {
                console.error(`Installer error: ${data}`);
            });

            installer.on('close', (code) => {
                if (code === 0) {
                    // Mark as installed
                    fs.writeFileSync(this.installedFlagPath, new Date().toISOString());
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Installation Complete',
                        message: 'Docker images have been installed successfully!\n\nThe app will now start normally.',
                        buttons: ['OK']
                    });
                    resolve(true);
                } else {
                    dialog.showErrorBox('Installation Failed', 
                        'Failed to install Docker images. Please check Docker is running and try again.');
                    reject(new Error(`Installation failed with code ${code}`));
                }
            });
        });
    }
}

module.exports = StandaloneInstaller;
