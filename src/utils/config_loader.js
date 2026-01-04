const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class ConfigLoader {
    static load(filePath) {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Config file not found at ${absolutePath}`);
        }
        const fileContent = fs.readFileSync(absolutePath, 'utf8');
        const config = yaml.parse(fileContent);

        // Basic validation
        if (!config.probes || !Array.isArray(config.probes)) {
            throw new Error('Config must have a "probes" array');
        }

        return config;
    }
}

module.exports = ConfigLoader;
