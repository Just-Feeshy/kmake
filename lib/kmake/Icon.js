"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportBmp = exports.exportPng24 = exports.exportPng = exports.exportIcns = exports.exportIco = void 0;
const log = require("kmake/log");
const exec = require("kmake/exec");
const cp = require("child_process");
const fs = require("fs");
const path = require("path");
function run(from, to, width, height, format, background, small, callback) {
    const exe = path.resolve(__dirname, 'kraffiti' + exec.sys());
    let params = ['from=' + from, 'to=' + to, 'format=' + format, 'keepaspect'];
    if (width > 0)
        params.push('width=' + width);
    if (height > 0)
        params.push('height=' + height);
    if (background !== undefined)
        params.push('background=' + background.toString(16));
    if (small)
        params.push('small');
    let child = cp.spawn(exe, params);
    child.stdout.on('data', (data) => {
        // log.info('kraffiti stdout: ' + data);
    });
    child.stderr.on('data', (data) => {
        log.error('kraffiti stderr: ' + data);
    });
    child.on('error', (err) => {
        log.error('kraffiti error: ' + err);
    });
    child.on('close', (code) => {
        if (code !== 0)
            log.error('kraffiti exited with code ' + code);
        callback();
    });
}
function findIcon(icon, from) {
    if (icon && fs.existsSync(path.join(from, icon)))
        return path.join(from, icon);
    if (fs.existsSync(path.join(from, 'icon.png')))
        return path.join(from, 'icon.png');
    else
        return path.join(__dirname, 'icon.png');
}
async function exportIco(icon, to, from, small) {
    return new Promise(resolve => {
        run(findIcon(icon, from.toString()), to.toString(), 0, 0, 'ico', undefined, small, resolve);
    });
}
exports.exportIco = exportIco;
async function exportIcns(icon, to, from) {
    return new Promise(resolve => {
        run(findIcon(icon, from.toString()), to.toString(), 0, 0, 'icns', undefined, false, resolve);
    });
}
exports.exportIcns = exportIcns;
async function exportPng(icon, to, width, height, background, from) {
    return new Promise(resolve => {
        run(findIcon(icon, from.toString()), to.toString(), width, height, 'png', background, false, resolve);
    });
}
exports.exportPng = exportPng;
async function exportPng24(icon, to, width, height, background, from) {
    return new Promise(resolve => {
        run(findIcon(icon, from.toString()), to.toString(), width, height, 'png24', background, false, resolve);
    });
}
exports.exportPng24 = exportPng24;
async function exportBmp(icon, to, width, height, background, from) {
    return new Promise(resolve => {
        run(findIcon(icon, from.toString()), to.toString(), width, height, 'bmp', background, false, resolve);
    });
}
exports.exportBmp = exportBmp;
//# sourceMappingURL=Icon.js.map