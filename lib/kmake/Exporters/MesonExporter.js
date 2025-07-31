"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MesonExporter = void 0;
const Platform_1 = require("kmake/Platform");
const path = require("path");
const Exporter_1 = require("kmake/Exporters/Exporter");
class MesonExporter extends Exporter_1.Exporter {
    constructor(options) {
        super(options);
    }
    async exportSolution(project, from, to, platform, vrApi, options) {
        let name = project.getSafeName();
        this.writeFile(path.resolve(to, 'meson.build'));
        // Collect include directories from project and add kore3/backend system includes
        let includeDirs = [...project.getIncludeDirs()];
        // Add kore3/backend system includes based on platform
        let systemOs = '';
        if (platform === Platform_1.Platform.Windows || platform === Platform_1.Platform.WindowsApp) {
            systemOs = 'windows';
        }
        else if (platform === Platform_1.Platform.OSX) {
            systemOs = 'macos';
        }
        else if (platform === Platform_1.Platform.iOS) {
            systemOs = 'ios';
        }
        else if (platform === Platform_1.Platform.tvOS) {
            systemOs = 'tvos';
        }
        else if (platform === Platform_1.Platform.Linux) {
            systemOs = 'linux';
        }
        else if (platform === Platform_1.Platform.Android) {
            systemOs = 'android';
        }
        if (includeDirs.length > 0) {
            this.p('inc_dirs = include_directories(');
            for (let i = 0; i < includeDirs.length; i++) {
                const inc = this.nicePath(from, to, includeDirs[i]);
                const comma = i === includeDirs.length - 1 ? '' : ',';
                this.p('  \'' + inc.replace(/\\/g, '/') + '\'' + comma, 1);
            }
            this.p(')');
            this.p();
        }
        // Add defines as compiler arguments instead of generating config header
        let defineArgs = [];
        if (project.getDefines().length > 0) {
            for (const def of project.getDefines()) {
                if (def.config && def.config.toLowerCase() === 'debug' && !options.debug) {
                    continue;
                }
                if (def.config && def.config.toLowerCase() === 'release' && options.debug) {
                    continue;
                }
                defineArgs.push('-D' + def.value);
            }
        }
        if (!options.debug) {
            defineArgs.push('-DNDEBUG');
        }
        if (project.cFlags.length > 0 || defineArgs.length > 0) {
            this.p('c_args = [');
            for (const flag of project.cFlags) {
                this.p('  \'' + flag + '\',', 1);
            }
            for (const def of defineArgs) {
                this.p('  \'' + def + '\',', 1);
            }
            this.p(']');
            this.p();
        }
        if (project.cppFlags.length > 0 || defineArgs.length > 0) {
            this.p('cpp_args = [');
            for (const flag of project.cppFlags) {
                this.p('  \'' + flag + '\',', 1);
            }
            for (const def of defineArgs) {
                this.p('  \'' + def + '\',', 1);
            }
            this.p(']');
            this.p();
        }
        let sourceFiles = project.getFiles().filter(file => {
            if (file.options && file.options.nocompile) {
                return false;
            }
            const ext = path.extname(file.file).toLowerCase();
            let validExtensions = ['.c', '.cpp', '.cc', '.cxx'];
            if (platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS) {
                validExtensions.push('.m', '.mm');
            }
            return validExtensions.includes(ext);
        });
        let metalFiles = project.getFiles().filter(file => {
            if (file.options && file.options.nocompile) {
                return false;
            }
            const ext = path.extname(file.file).toLowerCase();
            return ext === '.metal';
        });
        let headerFiles = project.getFiles().filter(file => {
            const ext = path.extname(file.file).toLowerCase();
            return ['.h', '.hpp', '.hxx'].includes(ext);
        });
        if (sourceFiles.length > 0) {
            this.p('sources = [');
            for (const fileObj of sourceFiles) {
                const relativePath = this.nicePath(from, to, fileObj.file);
                this.p('  \'' + relativePath.replace(/\\/g, '/') + '\',', 1);
            }
            this.p(']');
            this.p();
        }
        let allFiles = [];
        if (sourceFiles.length > 0) {
            allFiles.push('sources');
        }
        if (allFiles.length > 0) {
            this.p('target_files = ' + allFiles.join(' + '));
            this.p();
        }
        if (platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS) {
            this.p('add_languages(\'objc\')');
            this.p();
            if (defineArgs.length > 0) {
                this.p('objc_args = [');
                for (const def of defineArgs) {
                    this.p('  \'' + def + '\',', 1);
                }
                this.p(']');
                this.p();
            }
        }
        if (project.getLibs().length > 0) {
            this.p('dependencies = [');
            for (const lib of project.getLibs()) {
                this.p('  dependency(\'' + lib + '\'),', 1);
            }
            this.p(']');
            this.p();
        }
        // Handle Metal shader compilation for Apple platforms
        if ((platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS) && metalFiles.length > 0) {
            this.p('metal_compiler = find_program(\'xcrun\')');
            this.p();
            for (let i = 0; i < metalFiles.length; i++) {
                const metalFile = metalFiles[i];
                const relativePath = this.nicePath(from, to, metalFile.file);
                const baseName = path.basename(metalFile.file, '.metal');
                this.p(baseName + '_air = custom_target(\'' + baseName + '_air\',');
                this.p('  output: \'' + baseName + '.air\',', 1);
                this.p('  input: \'' + relativePath.replace(/\\/g, '/') + '\',', 1);
                this.p('  command: [metal_compiler, \'-sdk\', \'macosx\', \'metal\', \'-c\', \'@INPUT@\', \'-o\', \'@OUTPUT@\'],', 1);
                this.p('  build_by_default: true', 1);
                this.p(')');
                this.p();
                this.p(baseName + '_metallib = custom_target(\'' + baseName + '_metallib\',');
                this.p('  output: \'' + baseName + '.metallib\',', 1);
                this.p('  input: ' + baseName + '_air,', 1);
                this.p('  command: [metal_compiler, \'-sdk\', \'macosx\', \'metallib\', \'@INPUT@\', \'-o\', \'@OUTPUT@\'],', 1);
                this.p('  build_by_default: true', 1);
                this.p(')');
                this.p();
            }
        }
        let executableName = project.getSafeName();
        if (project.getExecutableName()) {
            executableName = project.getExecutableName();
        }
        let targetArgs = [];
        if (allFiles.length > 0) {
            targetArgs.push('target_files');
        }
        if (includeDirs.length > 0) {
            targetArgs.push('include_directories : inc_dirs');
        }
        if (project.cFlags.length > 0 || defineArgs.length > 0) {
            targetArgs.push('c_args : c_args');
        }
        if (project.cppFlags.length > 0 || defineArgs.length > 0) {
            targetArgs.push('cpp_args : cpp_args');
        }
        if ((platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS) && defineArgs.length > 0) {
            targetArgs.push('objc_args : objc_args');
        }
        if (project.getLibs().length > 0) {
            targetArgs.push('dependencies : dependencies');
        }
        if (project.linkerFlags.length > 0) {
            this.p('link_args = [');
            for (const flag of project.linkerFlags) {
                this.p('  \'' + flag + '\',', 1);
            }
            this.p(']');
            this.p();
            targetArgs.push('link_args : link_args');
        }
        if ((platform === Platform_1.Platform.iOS || platform === Platform_1.Platform.OSX || platform === Platform_1.Platform.tvOS) && metalFiles.length > 0) {
            const metallibTargets = metalFiles.map(file => path.basename(file.file, '.metal') + '_metallib');
            targetArgs.push('link_with : [' + metallibTargets.join(', ') + ']');
        }
        if (options.lib) {
            this.p(executableName + ' = library(\'' + executableName + '\',');
        }
        else if (options.dynlib) {
            this.p(executableName + ' = shared_library(\'' + executableName + '\',');
        }
        else {
            this.p('executable(\'' + executableName + '\',');
        }
        for (let i = 0; i < targetArgs.length; i++) {
            const comma = i === targetArgs.length - 1 ? '' : ',';
            this.p('  ' + targetArgs[i] + comma, 1);
        }
        this.p(')');
        this.closeFile();
    }
    mapCStandard(std) {
        switch (std) {
            case 'c90':
            case 'c89':
            case 'iso9899:1990':
                return 'c89';
            case 'gnu90':
            case 'gnu89':
                return 'gnu89';
            case 'c99':
            case 'c9x':
            case 'iso9899:1999':
                return 'c99';
            case 'gnu99':
            case 'gnu9x':
                return 'gnu99';
            case 'c11':
            case 'c1x':
            case 'iso9899:2011':
                return 'c11';
            case 'gnu11':
            case 'gnu1x':
                return 'gnu11';
            case 'c17':
            case 'c18':
            case 'iso9899:2017':
            case 'iso9899:2018':
                return 'c17';
            case 'gnu17':
            case 'gnu18':
                return 'gnu17';
            case 'c2x':
            case 'c23':
                return 'c2x';
            case 'gnu2x':
            case 'gnu23':
                return 'gnu2x';
            default:
                return 'c99';
        }
    }
    mapCppStandard(std) {
        switch (std) {
            case 'c++03':
            case 'c++98':
            case 'gnu++03':
            case 'gnu++98':
                return 'c++03';
            case 'c++11':
            case 'c++0x':
            case 'gnu++11':
            case 'gnu++0x':
                return 'c++11';
            case 'c++14':
            case 'c++1y':
            case 'gnu++14':
            case 'gnu++1y':
                return 'c++14';
            case 'c++17':
            case 'c++1z':
            case 'gnu++17':
            case 'gnu++1z':
                return 'c++17';
            case 'c++20':
            case 'c++2a':
            case 'gnu++20':
            case 'gnu++2a':
                return 'c++20';
            case 'c++23':
            case 'c++2b':
            case 'gnu++23':
            case 'gnu++2b':
                return 'c++23';
            case 'c++26':
            case 'c++2c':
            case 'gnu++26':
            case 'gnu++2c':
                return 'c++26';
            default:
                return 'c++17';
        }
    }
}
exports.MesonExporter = MesonExporter;
//# sourceMappingURL=MesonExporter.js.map