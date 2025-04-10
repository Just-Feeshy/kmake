"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.api = void 0;
const child_process = require("child_process");
const path = require("path");
const fs = require("kmake/fsextra");
const log = require("kmake/log");
const GraphicsApi_1 = require("kmake/GraphicsApi");
const Options_1 = require("kmake/Options");
const Project_1 = require("kmake/Project");
const Platform_1 = require("kmake/Platform");
const exec = require("kmake/exec");
const VisualStudioVersion_1 = require("kmake/VisualStudioVersion");
const AndroidExporter_1 = require("kmake/Exporters/AndroidExporter");
const LinuxExporter_1 = require("kmake/Exporters/LinuxExporter");
const EmscriptenExporter_1 = require("kmake/Exporters/EmscriptenExporter");
const WasmExporter_1 = require("kmake/Exporters/WasmExporter");
const VisualStudioExporter_1 = require("kmake/Exporters/VisualStudioExporter");
const XCodeExporter_1 = require("kmake/Exporters/XCodeExporter");
const VSCodeExporter_1 = require("kmake/Exporters/VSCodeExporter");
const FreeBSDExporter_1 = require("kmake/Exporters/FreeBSDExporter");
const JsonExporter_1 = require("kmake/Exporters/JsonExporter");
const Compiler_1 = require("kmake/Compiler");
let _global = global;
_global.__base = __dirname + '/';
let debug = false;
function fromPlatform(platform) {
    switch (platform.toLowerCase()) {
        case Platform_1.Platform.Windows:
            return 'Windows';
        case Platform_1.Platform.WindowsApp:
            return 'Windows App';
        case Platform_1.Platform.iOS:
            return 'iOS';
        case Platform_1.Platform.OSX:
            return 'macOS';
        case Platform_1.Platform.Android:
            return 'Android';
        case Platform_1.Platform.Linux:
            return 'Linux';
        case Platform_1.Platform.Emscripten:
            return 'Emscripten';
        case Platform_1.Platform.Pi:
            return 'Pi';
        case Platform_1.Platform.tvOS:
            return 'tvOS';
        case Platform_1.Platform.PS4:
            return 'PlayStation 4';
        case Platform_1.Platform.XboxOne:
            return 'Xbox One';
        case Platform_1.Platform.Switch:
            return 'Switch';
        case Platform_1.Platform.XboxSeries:
            return 'Xbox Series X|S';
        case Platform_1.Platform.PS5:
            return 'PlayStation 5';
        case Platform_1.Platform.FreeBSD:
            return 'FreeBSD';
        case Platform_1.Platform.Wasm:
            return 'Web Assembly';
        default:
            throw 'Unknown platform ' + platform + '.';
    }
}
function shaderLang(platform) {
    switch (platform) {
        case Platform_1.Platform.Windows:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.OpenGL:
                    return 'glsl';
                case GraphicsApi_1.GraphicsApi.Direct3D9:
                    return 'd3d9';
                case GraphicsApi_1.GraphicsApi.Direct3D11:
                    return 'd3d11';
                case GraphicsApi_1.GraphicsApi.Direct3D12:
                case GraphicsApi_1.GraphicsApi.Default:
                    return 'd3d11';
                case GraphicsApi_1.GraphicsApi.Vulkan:
                    return 'spirv';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.WindowsApp:
            return 'd3d11';
        case Platform_1.Platform.iOS:
        case Platform_1.Platform.tvOS:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                case GraphicsApi_1.GraphicsApi.Metal:
                    return 'metal';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                    return 'essl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.OSX:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                case GraphicsApi_1.GraphicsApi.Metal:
                    return 'metal';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                    return 'glsl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.Android:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                case GraphicsApi_1.GraphicsApi.Vulkan:
                    return 'spirv';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                    return 'essl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.Linux:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                case GraphicsApi_1.GraphicsApi.Vulkan:
                    return 'spirv';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                    return 'glsl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.Emscripten:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.WebGPU:
                    return 'spirv';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                case GraphicsApi_1.GraphicsApi.Default:
                    return 'essl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.Pi:
            return 'essl';
        case Platform_1.Platform.FreeBSD:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Vulkan:
                    return 'spirv';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                case GraphicsApi_1.GraphicsApi.Default:
                    return 'glsl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        case Platform_1.Platform.Wasm:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.WebGPU:
                    return 'spirv';
                case GraphicsApi_1.GraphicsApi.OpenGL:
                case GraphicsApi_1.GraphicsApi.Default:
                    return 'essl';
                default:
                    throw new Error('Unsupported shader language.');
            }
        default:
            return platform;
    }
}
function graphicsApi(platform) {
    switch (platform) {
        case Platform_1.Platform.Windows:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.Direct3D12;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.WindowsApp:
            return GraphicsApi_1.GraphicsApi.Direct3D11;
        case Platform_1.Platform.iOS:
        case Platform_1.Platform.tvOS:
        case Platform_1.Platform.OSX:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.Metal;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.Android:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.Vulkan;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.Linux:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.Vulkan;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.Emscripten:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.OpenGL;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.Pi:
            return GraphicsApi_1.GraphicsApi.OpenGL;
        case Platform_1.Platform.FreeBSD:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.OpenGL;
                default:
                    return Options_1.Options.graphicsApi;
            }
        case Platform_1.Platform.Wasm:
            switch (Options_1.Options.graphicsApi) {
                case GraphicsApi_1.GraphicsApi.Default:
                    return GraphicsApi_1.GraphicsApi.OpenGL;
                default:
                    return Options_1.Options.graphicsApi;
            }
        default:
            return Options_1.Options.graphicsApi;
    }
}
async function compileShader(projectDir, type, from, to, temp, platform, builddir, shaderversion) {
    return new Promise((resolve, reject) => {
        let compilerPath = '';
        if (Project_1.Project.koreDir !== '') {
            compilerPath = path.resolve(__dirname, 'krafix' + exec.sys());
        }
        let libsdir = path.join(projectDir, 'Backends');
        if (Project_1.Project.koreDir && !fs.existsSync(libsdir)) {
            libsdir = path.join(Project_1.Project.koreDir, '..', 'Backends');
        }
        if (fs.existsSync(libsdir) && fs.statSync(libsdir).isDirectory()) {
            let libdirs = fs.readdirSync(path.join(libsdir));
            for (let ld in libdirs) {
                let libdir = path.join(libsdir, libdirs[ld]);
                if (fs.statSync(libdir).isDirectory()) {
                    let exe = path.join(libdir, 'Tools', 'krafix-' + platform + '.exe');
                    if (fs.existsSync(exe)) {
                        compilerPath = exe;
                    }
                }
            }
        }
        if (compilerPath !== '') {
            if (type === 'metal') {
                fs.ensureDirSync(path.join(builddir, 'Sources'));
                let fileinfo = path.parse(from);
                let funcname = fileinfo.name;
                funcname = funcname.replace(/-/g, '_');
                funcname = funcname.replace(/\./g, '_');
                funcname += '_main';
                fs.writeFileSync(to, '>' + funcname, 'utf8');
                to = path.join(builddir, 'Sources', fileinfo.name + '.' + type);
                temp = to + '.temp';
            }
            let krafix_platform = platform;
            if (platform === Platform_1.Platform.Emscripten && Options_1.Options.graphicsApi === GraphicsApi_1.GraphicsApi.WebGPU) {
                krafix_platform += '-webgpu';
            }
            let params = [type, from, to, temp, krafix_platform];
            if (debug)
                params.push('--debug');
            if (shaderversion) {
                params.push('--version');
                params.push(shaderversion.toString());
            }
            if (Options_1.Options.outputIntermediateSpirv) {
                params.push('--outputintermediatespirv');
            }
            let compiler = child_process.spawn(compilerPath, params);
            compiler.stdout.on('data', (data) => {
                log.info(data.toString());
            });
            let errorLine = '';
            let newErrorLine = true;
            let errorData = false;
            function parseData(data) {
            }
            compiler.stderr.on('data', (data) => {
                let str = data.toString();
                for (let char of str) {
                    if (char === '\n') {
                        if (errorData) {
                            parseData(errorLine.trim());
                        }
                        else {
                            log.error(errorLine.trim());
                        }
                        errorLine = '';
                        newErrorLine = true;
                        errorData = false;
                    }
                    else if (newErrorLine && char === '#') {
                        errorData = true;
                        newErrorLine = false;
                    }
                    else {
                        errorLine += char;
                        newErrorLine = false;
                    }
                }
            });
            compiler.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(compilerPath + ' ' + params.join(' '));
                }
            });
        }
        else {
            throw 'Could not find shader compiler.';
        }
    });
}
class Invocation {
}
function compileShaders(invocations) {
    return new Promise((resolve, reject) => {
        let runningInstances = 0;
        let nextIndex = 0;
        function grabShader() {
            let invocation = invocations[nextIndex];
            ++nextIndex;
            ++runningInstances;
            log.info('Compiling shader ' + nextIndex + ' of ' + invocations.length + ' (' + invocation.name + ').');
            let promise = compileShader(invocation.projectDir, invocation.type, invocation.from, invocation.to, invocation.temp, invocation.platform, invocation.builddir, invocation.shaderversion);
            promise.then(() => {
                --runningInstances;
                if (nextIndex < invocations.length) {
                    grabShader();
                }
                else {
                    if (runningInstances == 0) {
                        resolve();
                    }
                }
            });
            promise.catch((err) => {
                reject('Compiling shader ' + invocation.name + ' failed. Command was: ' + err);
            });
        }
        if (invocations.length === 0) {
            resolve();
        }
        else {
            for (let i = 0; i < Options_1.Options.cores && i < invocations.length; ++i) {
                grabShader();
            }
        }
    });
}
function compileKong(project, from, to, platform, dirs) {
    return new Promise((resolve, reject) => {
        let compilerPath = '';
        if (Project_1.Project.koreDir !== '') {
            compilerPath = path.resolve(__dirname, 'kongruent' + exec.sys());
        }
        let libsdir = path.join(from, 'Backends');
        if (Project_1.Project.koreDir && !fs.existsSync(libsdir)) {
            libsdir = path.join(Project_1.Project.koreDir, '..', 'Backends');
        }
        if (fs.existsSync(libsdir) && fs.statSync(libsdir).isDirectory()) {
            let libdirs = fs.readdirSync(path.join(libsdir));
            for (let ld in libdirs) {
                let libdir = path.join(libsdir, libdirs[ld]);
                if (fs.statSync(libdir).isDirectory()) {
                    let exe = path.join(libdir, 'Tools', 'kongruent-' + platform + '.exe');
                    if (fs.existsSync(exe)) {
                        compilerPath = exe;
                    }
                }
            }
        }
        if (compilerPath !== '') {
            let api = graphicsApi(platform);
            to = path.join(to, 'Kong-' + platform + '-' + api);
            fs.ensureDirSync(to);
            project.addFile(to + '/**', undefined);
            project.addIncludeDir(to);
            let params = [];
            params.push('-p');
            params.push(platform);
            params.push('-a');
            params.push(api);
            if (debug) {
                params.push('--debug');
            }
            for (const dir of dirs) {
                params.push('-i');
                params.push(path.resolve(from, dir));
            }
            params.push('-o');
            params.push(to);
            let compiler = child_process.spawn(compilerPath, params);
            compiler.stdout.on('data', (data) => {
                log.info(data.toString());
            });
            let errorLine = '';
            let newErrorLine = true;
            let errorData = false;
            function parseData(data) {
            }
            compiler.stderr.on('data', (data) => {
                let str = data.toString();
                for (let char of str) {
                    if (char === '\n') {
                        if (errorData) {
                            parseData(errorLine.trim());
                        }
                        else {
                            log.error(errorLine.trim());
                        }
                        errorLine = '';
                        newErrorLine = true;
                        errorData = false;
                    }
                    else if (newErrorLine && char === '#') {
                        errorData = true;
                        newErrorLine = false;
                    }
                    else {
                        errorLine += char;
                        newErrorLine = false;
                    }
                }
            });
            compiler.on('error', (err) => {
                reject('Could not run Kong (because ' + err + ') with ' + compilerPath + ' ' + params.join(' '));
            });
            compiler.on('close', (code, signal) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    if (code === null) {
                        reject('Kong signaled ' + signal + ' for ' + compilerPath + ' ' + params.join(' '));
                    }
                    else {
                        reject('Kong returned ' + code + ' for ' + compilerPath + ' ' + params.join(' '));
                    }
                }
            });
        }
        else {
            throw 'Could not find Kong.';
        }
    });
}
let consoleCompilePlatform = null;
async function exportKoremakeProject(from, to, platform, korefile, retro, veryretro, options) {
    log.info('kfile found.');
    if (options.onlyshaders) {
        log.info('Only compiling shaders.');
    }
    else if (options.toLanguage) {
        log.info('Only exporting language wrappers ' + options.toLanguage + '.');
    }
    else {
        log.info('Creating ' + fromPlatform(platform) + ' project files.');
    }
    Project_1.Project.root = path.resolve(from);
    let project;
    try {
        project = await Project_1.Project.create(from, to, platform, korefile, retro, veryretro, options.option);
        if (shaderLang(platform) === 'metal') {
            project.addFile(path.join(to, 'Sources', '*'), {});
        }
        project.resolveBackends();
        project.searchFiles(undefined);
        project.internalFlatten();
        if (options.lib) {
            project.addDefine('KORE_NO_MAIN');
            project.isStaticLib = true;
        }
        else if (options.dynlib) {
            project.addDefine('KORE_NO_MAIN');
            project.addDefine('KORE_DYNAMIC_COMPILE');
            project.isDynamicLib = true;
        }
    }
    catch (error) {
        log.error(error);
        throw error;
    }
    fs.ensureDirSync(to);
    let files = project.getFiles();
    if (!options.noshaders && !options.json) {
        if (project.kongDirs.length > 0) {
            await compileKong(project, from, to, platform, project.kongDirs);
        }
        else {
            /*let compilerPath = '';
            if (Project.koreDir !== '') {
                compilerPath = path.resolve(__dirname, 'krafix' + exec.sys());
            }

            const matches = [];
            for (let file of files) {
                if (file.file.endsWith('.glsl')) {
                    matches.push({match: file.file, options: null});
                }
            }

            let shaderCompiler = new ShaderCompiler(platform, compilerPath, project.getDebugDir(), options.to,
                options.to builddir, matches);
            try {
                await shaderCompiler.run(false, false);
            }
            catch (err) {
                return Promise.reject(err);
            }*/
            let shaderCount = 0;
            for (let file of files) {
                if (file.file.endsWith('.glsl')) {
                    ++shaderCount;
                }
            }
            let shaderIndex = 0;
            let invocations = [];
            for (let file of files) {
                if (file.file.endsWith('.glsl')) {
                    let outfile = file.file;
                    const index = outfile.lastIndexOf('/');
                    if (index > 0)
                        outfile = outfile.substr(index);
                    outfile = outfile.substr(0, outfile.length - 5);
                    let parsedFile = path.parse(file.file);
                    const shader = path.isAbsolute(file.file) ? file.file : path.join(file.projectDir, file.file);
                    ++shaderIndex;
                    invocations.push({
                        projectDir: from,
                        type: shaderLang(platform),
                        from: shader,
                        to: path.join(project.getDebugDir(), outfile),
                        temp: options.to,
                        platform: platform,
                        builddir: options.to,
                        name: parsedFile.name,
                        shaderversion: project.shaderVersion,
                    });
                    //await compileShader(from, shaderLang(platform), shader, path.join(project.getDebugDir(), outfile), options.to, platform, options.to);
                }
            }
            await compileShaders(invocations);
        }
    }
    if (options.onlyshaders) {
        return [project, null];
    }
    // Run again to find new shader files for Metal
    project.searchFiles(undefined);
    project.internalFlatten();
    let exporter = null;
    if (options.vscode) {
        exporter = new VSCodeExporter_1.VSCodeExporter(options);
    }
    else if (options.json) {
        exporter = new JsonExporter_1.JsonExporter(options);
    }
    else if (platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS)
        exporter = new XCodeExporter_1.XCodeExporter(options);
    else if (platform === Platform_1.Platform.Android)
        exporter = new AndroidExporter_1.AndroidExporter(options);
    else if (platform === Platform_1.Platform.Emscripten)
        exporter = new EmscriptenExporter_1.EmscriptenExporter(project, options);
    else if (platform === Platform_1.Platform.Wasm)
        exporter = new WasmExporter_1.WasmExporter(options);
    else if (platform === Platform_1.Platform.Linux || platform === Platform_1.Platform.Pi)
        exporter = new LinuxExporter_1.LinuxExporter(options);
    else if (platform === Platform_1.Platform.FreeBSD)
        exporter = new FreeBSDExporter_1.FreeBSDExporter(options);
    else if (platform === Platform_1.Platform.PS4 || platform === Platform_1.Platform.XboxOne || platform === Platform_1.Platform.Switch || platform === Platform_1.Platform.XboxSeries || platform === Platform_1.Platform.PS5) {
        let libsdir = path.join(from.toString(), 'Backends');
        if (Project_1.Project.koreDir && !fs.existsSync(libsdir)) {
            libsdir = path.join(Project_1.Project.koreDir, '..', 'Backends');
        }
        if (fs.existsSync(libsdir) && fs.statSync(libsdir).isDirectory()) {
            let libdirs = fs.readdirSync(libsdir);
            for (let libdir of libdirs) {
                if (fs.statSync(path.join(libsdir, libdir)).isDirectory()
                    && (libdir.toLowerCase() === platform.toLowerCase()
                        || libdir.toLowerCase() === fromPlatform(platform).toLowerCase()
                        || libdir.toLowerCase() === fromPlatform(platform).replace(/ /g, '').toLowerCase()
                        || (libdir.toLowerCase() === 'xbox' && (platform === Platform_1.Platform.XboxSeries || platform === Platform_1.Platform.XboxOne)))) {
                    let libfiles = fs.readdirSync(path.join(libsdir, libdir));
                    for (let libfile of libfiles) {
                        if (libfile.endsWith('Exporter.js')) {
                            const codePath = path.resolve(libsdir, libdir, libfile);
                            const code = fs.readFileSync(codePath, { encoding: 'utf8' });
                            exporter = new Function('require', '__dirname', 'VisualStudioExporter', code)(require, path.resolve(libsdir, libdir), VisualStudioExporter_1.VisualStudioExporter);
                            let vsExporter = exporter;
                            consoleCompilePlatform = vsExporter.getSystems(platform)[0];
                            break;
                        }
                    }
                }
            }
        }
    }
    else
        exporter = new VisualStudioExporter_1.VisualStudioExporter(options);
    /*let langExporter: Language = null;
    let trees: idl.IDLRootType[][] = [];
    if (options.toLanguage === Languages.Beef) {
        langExporter = new BeefLang();
        for ( let file of project.IDLfiles) {
            let webidl = fs.readFileSync(file).toString();
            trees.push(idl.parse(webidl));
        }
    }
    if (exporter === null && langExporter === null) {
        throw 'No exporter found for platform ' + platform + '.';
    }*/
    if (Project_1.Project.koreDir) {
        try {
            fs.writeFileSync(path.join(to, 'korepath'), path.relative(from, Project_1.Project.koreDir), 'utf8');
        }
        catch (err) {
            log.error('Could not write korepath file');
        }
    }
    const hash = project.createHash(options.vscode, options.json, platform);
    let oldHash = null;
    try {
        oldHash = fs.readFileSync(path.join(to, 'projecthash'), { encoding: 'utf8' });
    }
    catch (err) { }
    if (hash !== oldHash) {
        log.info('Project changed, writing project files.');
        fs.writeFileSync(path.join(to, 'projecthash'), hash, 'utf8');
        if (exporter !== null) {
            await exporter.exportSolution(project, from, to, platform, options.vrApi, options);
        }
    }
    else {
        log.info('Project did not change.');
    }
    /*if (langExporter !== null) {
        trees.forEach((tree, index) => {
            langExporter.exportWrapper(tree, from, to, options, project.IDLfiles[index]);
        });
    }*/
    return [project, exporter];
}
function isKoremakeProject(directory, korefile) {
    return fs.existsSync(path.resolve(directory, korefile));
}
async function exportProject(from, to, platform, korefile, options) {
    if (isKoremakeProject(from, korefile)) {
        return exportKoremakeProject(from, to, platform, korefile, false, false, options);
    }
    else if (isKoremakeProject(from, 'kfile.js')) {
        return exportKoremakeProject(from, to, platform, 'kfile.js', false, false, options);
    }
    else if (isKoremakeProject(from, 'kincfile.js')) {
        return exportKoremakeProject(from, to, platform, 'kincfile.js', true, false, options);
    }
    else if (isKoremakeProject(from, 'korefile.js')) {
        return exportKoremakeProject(from, to, platform, 'korefile.js', true, true, options);
    }
    else {
        throw 'kfile not found.';
    }
}
class RunError {
    constructor(code) {
        this.code = code;
    }
}
function compileProject(make, project, solutionName, options, dothemath) {
    const startDate = new Date();
    return new Promise((resolve, reject) => {
        make.stdout.on('data', function (data) {
            log.info(data.toString(), false);
        });
        make.stderr.on('data', function (data) {
            log.error(data.toString(), false);
        });
        let errored = false;
        make.on('error', (err) => {
            errored = true;
            log.error('Could not start the compiler.');
            reject();
        });
        make.on('close', function (code) {
            if (errored) {
                return;
            }
            const time = (new Date().getTime() - startDate.getTime()) / 1000;
            const min = Math.floor(time / 60);
            const sec = Math.floor(time - min * 60);
            log.info(`Build time: ${min}m ${sec}s`);
            if (code === 0) {
                let executableName = project.getSafeName();
                if (project.getExecutableName()) {
                    executableName = project.getExecutableName();
                }
                if ((options.customTarget && options.customTarget.baseTarget === Platform_1.Platform.Linux) || options.target === Platform_1.Platform.Linux) {
                    if (options.lib) {
                        fs.copyFileSync(path.resolve(path.join(options.to.toString(), options.buildPath), executableName + '.a'), path.resolve(options.from.toString(), project.getDebugDir(), executableName + '.a'));
                    }
                    else if (options.dynlib) {
                        fs.copyFileSync(path.resolve(path.join(options.to.toString(), options.buildPath), executableName + '.so'), path.resolve(options.from.toString(), project.getDebugDir(), executableName + '.so'));
                    }
                    else {
                        fs.copyFileSync(path.resolve(path.join(options.to.toString(), options.buildPath), executableName), path.resolve(options.from.toString(), project.getDebugDir(), executableName));
                    }
                }
                else if ((options.customTarget && options.customTarget.baseTarget === Platform_1.Platform.Windows) || options.target === Platform_1.Platform.Windows) {
                    const extension = (options.lib || options.dynlib) ? (options.lib ? '.lib' : '.dll') : '.exe';
                    const from = dothemath
                        ? path.join(options.to.toString(), 'x64', options.debug ? 'Debug' : 'Release', executableName + extension)
                        : path.join(options.to.toString(), options.debug ? 'Debug' : 'Release', executableName + extension);
                    const dir = path.isAbsolute(project.getDebugDir())
                        ? project.getDebugDir()
                        : path.join(options.from.toString(), project.getDebugDir());
                    fs.copyFileSync(from, path.join(dir, executableName + extension));
                }
                if (options.run) {
                    if ((options.customTarget && options.customTarget.baseTarget === Platform_1.Platform.OSX) || options.target === Platform_1.Platform.OSX) {
                        const spawned = child_process.spawn(path.resolve(options.to.toString(), 'build', (options.debug ? 'Debug' : 'Release'), project.name + '.app', 'Contents', 'MacOS', project.name), { stdio: 'inherit', cwd: path.resolve(options.from.toString(), project.getDebugDir()) });
                        spawned.on('close', (code) => {
                            if (code === 0) {
                                resolve();
                            }
                            else {
                                reject(new RunError(code));
                            }
                        });
                    }
                    else if ((options.customTarget && (options.customTarget.baseTarget === Platform_1.Platform.Linux || options.customTarget.baseTarget === Platform_1.Platform.Windows)) || options.target === Platform_1.Platform.Linux || options.target === Platform_1.Platform.Windows) {
                        if (process.platform === 'win32') {
                            require('os').runProcess(path.resolve(options.from.toString(), project.getDebugDir(), executableName), path.resolve(options.from.toString(), project.getDebugDir()));
                        }
                        else {
                            const spawned = child_process.spawn(path.resolve(options.from.toString(), project.getDebugDir(), executableName), [], { stdio: 'inherit', cwd: path.resolve(options.from.toString(), project.getDebugDir()) });
                            spawned.on('close', (code) => {
                                if (code === 0) {
                                    resolve();
                                }
                                else {
                                    reject(new RunError(code));
                                }
                            });
                        }
                    }
                    else {
                        log.info('--run not yet implemented for this platform');
                        reject(new RunError(1));
                    }
                }
                else {
                    resolve();
                }
            }
            else {
                log.error('Compilation failed.');
                reject(code);
            }
        });
    });
}
exports.api = 2;
function findKoreVersion(dir) {
    if (fs.existsSync(path.join(dir, '.git'))) {
        let gitVersion = 'git-error';
        try {
            const output = child_process.spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: dir }).output;
            for (const str of output) {
                if (str != null && str.length > 0) {
                    gitVersion = str.substr(0, 8);
                    break;
                }
            }
        }
        catch (error) {
        }
        let gitStatus = 'git-error';
        try {
            const output = child_process.spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: dir }).output;
            gitStatus = '';
            for (const str of output) {
                if (str != null && str.length > 0) {
                    gitStatus = str.trim();
                    break;
                }
            }
        }
        catch (error) {
        }
        if (gitStatus) {
            return gitVersion + ', ' + gitStatus.replace(/\n/g, ',');
        }
        else {
            return gitVersion;
        }
    }
    else {
        return 'unversioned';
    }
}
function is64bit() {
    return process.arch === 'x64' || process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
}
function isPlatform(options, platform) {
    return (options.customTarget && options.customTarget.baseTarget === platform) || options.target === platform;
}
async function run(options, loglog) {
    log.set(loglog);
    if (options.graphics !== undefined) {
        Options_1.Options.graphicsApi = options.graphics;
    }
    if (options.arch !== undefined) {
        Options_1.Options.architecture = options.arch;
    }
    if (options.audio !== undefined) {
        Options_1.Options.audioApi = options.audio;
    }
    if (options.vr !== undefined) {
        Options_1.Options.vrApi = options.vr;
    }
    if (options.compiler !== undefined) {
        Options_1.Options.compiler = options.compiler;
    }
    if (options.cc) {
        Options_1.Options.ccPath = options.cc;
        Options_1.Options.compiler = Compiler_1.Compiler.Custom;
    }
    if (options.cxx) {
        Options_1.Options.cxxPath = options.cxx;
        Options_1.Options.compiler = Compiler_1.Compiler.Custom;
    }
    if (options.ar) {
        Options_1.Options.arPath = options.ar;
        Options_1.Options.compiler = Compiler_1.Compiler.Custom;
    }
    if (Options_1.Options.compiler === Compiler_1.Compiler.Custom) {
        let error = false;
        if (Options_1.Options.ccPath === '') {
            log.error('Missing C compiler path');
            error = true;
        }
        if (Options_1.Options.cxxPath === '') {
            log.error('Missing C++ compiler path');
            error = true;
        }
        if ((options.lib || options.dynlib) && Options_1.Options.arPath === '') {
            log.error('Missing ar path');
            error = true;
        }
        if (error)
            throw 'Missing compiler path(s)';
    }
    if (options.visualstudio !== undefined) {
        Options_1.Options.visualStudioVersion = options.visualstudio;
    }
    if (options.cores !== undefined) {
        Options_1.Options.cores = parseInt(options.cores);
    }
    else {
        Options_1.Options.cores = require('os').properCpuCount();
    }
    if (options.nosymlinks) {
        Options_1.Options.followSymbolicLinks = false;
    }
    if (options.outputintermediatespirv) {
        Options_1.Options.outputIntermediateSpirv = true;
    }
    Options_1.Options.debug = options.debug;
    if (!options.kore) {
        let p = path.join(__dirname, '..', '..');
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
            options.kore = p;
        }
    }
    else {
        options.kore = path.resolve(options.kore);
    }
    Project_1.Project.koreDir = options.kore;
    options.from = path.resolve(options.from);
    options.to = path.resolve(options.to);
    log.info('Using Kore (' + findKoreVersion(options.kore) + ') from ' + options.kore);
    if ((options.customTarget && options.customTarget.baseTarget === Platform_1.Platform.Wasm) || options.target === Platform_1.Platform.Wasm) {
        log.info('Please not that the Wasm-target is still in early development. Please use the Emscripten-target in the meantime - the Wasm-target will eventually be a more elegant but harder to use alternative.');
    }
    debug = options.debug;
    if (options.vr !== undefined) {
        Options_1.Options.vrApi = options.vr;
    }
    options.buildPath = options.debug ? 'debug' : 'release';
    let project = null;
    let exporter = null;
    try {
        const value = await exportProject(options.from, options.to, options.target, options.kfile, options);
        project = value[0];
        exporter = value[1];
    }
    catch (error) {
        throw error;
    }
    let solutionName = project.getSafeName();
    if (options.onlyshaders) {
        return solutionName;
    }
    if (options.compile && solutionName !== '') {
        log.info('Compiling...');
        const dothemath = is64bit();
        let make = null;
        if (isPlatform(options, Platform_1.Platform.Linux) || isPlatform(options, Platform_1.Platform.Wasm) || isPlatform(options, Platform_1.Platform.Pi) || isPlatform(options, Platform_1.Platform.Emscripten)) {
            make = child_process.spawn('ninja', [], { cwd: path.join(options.to, options.buildPath) });
        }
        else if (isPlatform(options, Platform_1.Platform.FreeBSD)) {
            make = child_process.spawn('make', [], { cwd: path.join(options.to, options.buildPath) });
        }
        else if (isPlatform(options, Platform_1.Platform.OSX) || isPlatform(options, Platform_1.Platform.iOS) || isPlatform(options, Platform_1.Platform.tvOS)) {
            let xcodeOptions = ['-configuration', options.debug ? 'Debug' : 'Release', '-project', solutionName + '.xcodeproj'];
            if (options.nosigning) {
                xcodeOptions.push('CODE_SIGN_IDENTITY=""');
                xcodeOptions.push('CODE_SIGNING_REQUIRED=NO');
                xcodeOptions.push('CODE_SIGNING_ALLOWED=NO');
            }
            make = child_process.spawn('xcodebuild', xcodeOptions, { cwd: options.to });
        }
        else if (isPlatform(options, Platform_1.Platform.Windows)
            || isPlatform(options, Platform_1.Platform.WindowsApp)
            || isPlatform(options, Platform_1.Platform.Switch)
            || isPlatform(options, Platform_1.Platform.PS4)
            || isPlatform(options, Platform_1.Platform.PS5)
            || isPlatform(options, Platform_1.Platform.XboxOne)
            || isPlatform(options, Platform_1.Platform.XboxSeries)) {
            let vsvars = null;
            const bits = dothemath ? '64' : '32';
            switch (options.visualstudio) {
                case VisualStudioVersion_1.VisualStudioVersion.VS2010:
                    if (process.env.VS100COMNTOOLS) {
                        vsvars = process.env.VS100COMNTOOLS + '\\vsvars' + bits + '.bat';
                    }
                    break;
                case VisualStudioVersion_1.VisualStudioVersion.VS2012:
                    if (process.env.VS110COMNTOOLS) {
                        vsvars = process.env.VS110COMNTOOLS + '\\vsvars' + bits + '.bat';
                    }
                    break;
                case VisualStudioVersion_1.VisualStudioVersion.VS2013:
                    if (process.env.VS120COMNTOOLS) {
                        vsvars = process.env.VS120COMNTOOLS + '\\vsvars' + bits + '.bat';
                    }
                    break;
                case VisualStudioVersion_1.VisualStudioVersion.VS2015:
                    if (process.env.VS140COMNTOOLS) {
                        vsvars = process.env.VS140COMNTOOLS + '\\vsvars' + bits + '.bat';
                    }
                    break;
                default:
                    const vswhere = path.join(process.env['ProgramFiles(x86)'], 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
                    const varspath = child_process.execFileSync(vswhere, ['-products', '*', '-latest', '-find', 'VC\\Auxiliary\\Build\\vcvars' + bits + '.bat'], { encoding: 'utf8' }).trim();
                    if (fs.existsSync(varspath)) {
                        vsvars = varspath;
                    }
                    break;
            }
            if (vsvars !== null) {
                const signing = ((options.customTarget && options.customTarget.baseTarget === Platform_1.Platform.WindowsApp) || options.target === Platform_1.Platform.WindowsApp) ? '/p:AppxPackageSigningEnabled=false' : '';
                let compilePlatform = dothemath ? 'x64' : 'win32';
                if (consoleCompilePlatform) {
                    compilePlatform = consoleCompilePlatform;
                }
                fs.writeFileSync(path.join(options.to, 'build.bat'), '@call "' + vsvars + '"\n' + '@MSBuild.exe "' + path.resolve(options.to, solutionName + '.vcxproj') + '" /m /clp:ErrorsOnly ' + signing + ' /p:Configuration=' + (options.debug ? 'Debug' : 'Release') + ',Platform=' + compilePlatform);
                make = child_process.spawn('build.bat', [], { cwd: options.to });
            }
            else {
                log.error('Visual Studio not found.');
            }
        }
        else if (isPlatform(options, Platform_1.Platform.Android)) {
            let gradlew = (process.platform === 'win32') ? 'gradlew.bat' : 'bash';
            let args = (process.platform === 'win32') ? [] : ['gradlew'];
            args.push('assemble' + (options.debug ? 'Debug' : 'Release'));
            make = child_process.spawn(gradlew, args, { cwd: path.join(options.to, solutionName) });
        }
        if (make !== null) {
            try {
                await compileProject(make, project, solutionName, options, dothemath);
            }
            catch (err) {
                if (typeof (err) === 'number') {
                    throw 'Compile error';
                }
                else if (err instanceof RunError) {
                    throw 'Run Error (code ' + err.code + ')';
                }
                else {
                    if (isPlatform(options, Platform_1.Platform.Linux) || isPlatform(options, Platform_1.Platform.Wasm) || isPlatform(options, Platform_1.Platform.Pi) || isPlatform(options, Platform_1.Platform.Emscripten)) {
                        log.error('Ninja could not be run, falling back to make.');
                        make = child_process.spawn('make', ['-j', Options_1.Options.cores.toString()], { cwd: path.join(options.to, options.buildPath) });
                        try {
                            await compileProject(make, project, solutionName, options, dothemath);
                        }
                        catch (err) {
                            if (typeof (err) === 'number') {
                                throw 'Compile error (code ' + err + ')';
                            }
                            else if (err instanceof RunError) {
                                throw 'Run Error (code ' + err.code + ')';
                            }
                            else {
                                throw 'Compiler not found';
                            }
                        }
                    }
                    else {
                        throw 'Compiler not found';
                    }
                }
            }
            return solutionName;
        }
        else {
            log.info('--compile not yet implemented for this platform');
            process.exit(1);
        }
    }
    if (options.open) {
        exporter.open(project, options.to);
    }
    return solutionName;
}
exports.run = run;
//# sourceMappingURL=main.js.map