import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source directory containing the built files
const srcDir = path.resolve(__dirname, './dist');
// Destination directory inside the web project
const destDir = path.resolve(__dirname, '../mindmap-embed/dist');

// Remove existing destination directory if it exists
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}

// Copy the entire dist folder to the web project's dist directory
if (fs.existsSync(srcDir)) {
    // Node 16+ supports recursive copy
    fs.cpSync(srcDir, destDir, { recursive: true });
    // Optionally, clean up the source dist folder after copying
    // fs.rmSync(srcDir, { recursive: true, force: true });
}
