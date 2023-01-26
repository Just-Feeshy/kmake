import { Project } from 'kmake/Project';
import * as fs from 'kmake/fsextra';
import * as path from 'path';
import { Platform } from 'kmake/Platform';
import * as log from 'kmake/log';
import * as os from 'os';
import * as child_process from 'child_process';

enum WriteMode {
	None,
	File,
	Stdout
}

export abstract class Exporter {
	writeMode: WriteMode = WriteMode.None;
	outFile: number = 0;
	outString: string = null;

	constructor() {

	}

	writeFile(file: string) {
		this.writeMode = WriteMode.File;
		this.outFile = fs.openSync(file, 'w');
		this.outString = null;
	}

	writeStdout() {
		this.writeMode = WriteMode.Stdout;
		this.outString = '';
		this.outFile = 0;
	}

	closeFile() {
		fs.closeSync(this.outFile);
		this.outFile = 0;
		this.outString = null;
		this.writeMode = WriteMode.None;
	}

	closeStdout() {
		this.outString = null;
		this.outFile = 0;
		this.writeMode = WriteMode.None;
	}

	p(line: string = '', indent: number = 0) {
		let tabs = '';
		for (let i = 0; i < indent; ++i) {
			tabs += '\t';
		}
		
		if (this.writeMode === WriteMode.Stdout) {
			log.info(tabs + line);
		}
		else if (this.writeMode === WriteMode.File) {
			let data = Buffer.from(tabs + line + '\n');
			fs.writeSync(this.outFile, data, 0, data.length, null);
		}
		else {
			throw 'Writing while not actually writing';
		}
	}

	nicePath(from: string, to: string, filepath: string): string {
		let absolute = filepath;
		if (!path.isAbsolute(absolute)) {
			absolute = path.resolve(from, filepath);
		}
		return path.relative(to, absolute);
	}

	async exportSolution(project: Project, from: string, to: string, platform: string, vrApi: any, options: any): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			reject('Called an abstract function');
		});
	}

	exportCLion(project: Project, from: string, to: string, platform: string, vrApi: any, options: any) {
		let name = project.getSafeName();

		const indir = path.join(__dirname, '..', '..', 'Data', 'linux');
		fs.ensureDirSync(path.resolve(to, name, '.idea'));

		let misc = require('fs').getEmbeddedData()['linux_idea_misc_xml'];
		misc = misc.replace(/{root}/g, path.resolve(from));
		fs.writeFileSync(path.join(to, name, '.idea', 'misc.xml'), misc, 'utf8');

		let workspace = require('fs').getEmbeddedData()['linux_idea_workspace_xml'];
		workspace = workspace.replace(/{workingdir}/g, path.resolve(project.getDebugDir()));
		workspace = workspace.replace(/{project}/g, name);
		workspace = workspace.replace(/{target}/g, name);
		fs.writeFileSync(path.join(to, name, '.idea', 'workspace.xml'), workspace, 'utf8');

		this.writeFile(path.resolve(to, name, 'CMakeLists.txt'));

		this.p('cmake_minimum_required(VERSION 3.10)');  // should be 3.12 to support c++20, 3.20 to support c++23 and 3.21 to support c17/c23

		this.p('project(' + name + ')');
		switch (project.cppStd) {
			case 'gnu++03':
			case 'c++03':
				this.p('set(CMAKE_CXX_STANDARD 03)');
				break;
			case 'gnu++11':
			case 'c++11':
				this.p('set(CMAKE_CXX_STANDARD 11)');
				break;
			case 'gnu++14':
			case 'c++14':
				this.p('set(CMAKE_CXX_STANDARD 14)');
				break;
			case 'gnu++17':
			case 'c++17':
				this.p('set(CMAKE_CXX_STANDARD 17)');
				break;
			case 'gnu++2a':
			case 'c++2a':
			case 'gnu++20':
			case 'c++20':
				this.p('set(CMAKE_CXX_STANDARD 20)');
				break;
			case 'gnu++2b':
			case 'c++2b':
			case 'gnu++23':
			case 'c++23':
				this.p('set(CMAKE_CXX_STANDARD 23)');
				break;
			default:
				this.p('set(CMAKE_CXX_STANDARD 98)');
				break;
		}

		switch (project.cStd) {
			case 'gnu9x':
			case 'gnu99':
			case 'c9x':
			case 'c99':
				this.p('set(CMAKE_C_STANDARD 99)');
				break;
			case 'gnu1x':
			case 'gnu11':
			case 'c1x':
			case 'c11':
				this.p('set(CMAKE_C_STANDARD 11)');
				break;
			case 'gnu18':
			case 'gnu17':
			case 'c18':
			case 'c17':
				this.p('set(CMAKE_C_STANDARD 17)');
				break;
			case 'gnu2x':
			case 'c2x':
				this.p('set(CMAKE_C_STANDARD 23)');
				break;
			default:
				this.p('set(CMAKE_C_STANDARD 90)');
				break;
		}

		this.p('set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread -static-libgcc -static-libstdc++")');

		let debugDefines = '';
		for (const def of project.getDefines()) {
			if (!def.config || def.config.toLowerCase() === 'debug') {
				debugDefines += ' -D' + def.value;
			}
		}
		this.p('set(CMAKE_C_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG}' + debugDefines + '")');
		this.p('set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG}' + debugDefines + '")');

		let releaseDefines = '';
		for (const def of project.getDefines()) {
			if (!def.config || def.config.toLowerCase() === 'release') {
				releaseDefines += ' -D' + def.value;
			}
		}
		releaseDefines += ' -DNDEBUG';
		this.p('set(CMAKE_C_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE}' + releaseDefines + '")');
		this.p('set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE}' + releaseDefines + '")');

		let includes = '';
		for (let inc of project.getIncludeDirs()) {
			includes += '  "' + path.resolve(inc).replace(/\\/g, '/') + '"\n';
		}
		this.p('include_directories(\n' + includes + ')');

		let files = '';
		for (let file of project.getFiles()) {
			if (file.file.endsWith('.c') || file.file.endsWith('.cc') || file.file.endsWith('.cpp') || file.file.endsWith('.h')) {
				files += '  "' + path.resolve(file.file).replace(/\\/g, '/') + '"\n';
			}
		}
		this.p('set(SOURCE_FILES\n' + files + ')');

		this.p('add_executable(' + name + ' ${SOURCE_FILES})');

		let libraries = '';
		for (let lib of project.getLibs()) {
			libraries += '  ' + lib + '\n';
		}
		this.p('target_link_libraries(' + name + '\n' + libraries + ')');

		this.closeFile();
	}

	exportCompileCommands(project: Project, _from: string, to: string, platform: string, vrApi: any, options: any) {
		let from = path.resolve(process.cwd(), _from);

		this.writeFile(path.resolve(to, 'compile_commands.json'));
		let includes = [];
		for (let inc of project.getIncludeDirs()) {
			includes.push('-I');
			includes.push(path.resolve(from, inc));
		}

		let defines = [];
		for (let def of project.getDefines()) {
			defines.push('-D');
			defines.push(def.value.replace(/\"/g, '\\"'));
		}

		let objects: any = {};
		let ofiles: any = {};
		for (let fileobject of project.getFiles()) {
			let file = fileobject.file;
			if (file.endsWith('.cpp') || file.endsWith('.c') || file.endsWith('.cc') || file.endsWith('.s') || file.endsWith('.S')) {
				let name = file.toLowerCase();
				if (name.indexOf('/') >= 0) name = name.substr(name.lastIndexOf('/') + 1);
				name = name.substr(0, name.lastIndexOf('.'));
				if (!objects[name]) {
					objects[name] = true;
					ofiles[file] = name;
				}
				else {
					while (objects[name]) {
						name = name + '_';
					}
					objects[name] = true;
					ofiles[file] = name;
				}
			}
		}

		let defaultArgs = [];

		// TODO: same for MacOS, Windows, etc...
		if (platform === Platform.Android) {
			defaultArgs.push('--target=aarch64-none-linux-android21');
			defaultArgs.push('-DANDROID');

			// take a guess at where the ndk could be

			function ndkFromSdkRoot() {
				let sdkEnv = process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT'];
				if (!sdkEnv) return null;
				let ndk_dir = path.join(sdkEnv, 'ndk');
				if (!fs.existsSync(ndk_dir)) {
					return null;
				}
				let ndks = fs.readdirSync(ndk_dir);
				ndks = ndks.filter(item => !item.startsWith("."));
				if (ndks.length < 1) {
					return null;
				}
				return path.join(ndk_dir, ndks[0]);
			}

			let android_ndk = process.env['ANDROID_NDK'] ?? ndkFromSdkRoot();

			if (android_ndk) {
				let host_tag = '';
				switch (os.platform()) {
					// known host tags
					// TODO: figure out the host tag for aarch64 darwin/linux/windows
					case 'linux':
						host_tag = 'linux-x86_64';
						break;
					case 'darwin':
						host_tag = 'darwin-x86_64';
						break;
					case 'win32':
						host_tag = 'windows-x86_64';
						break;
				}
				let ndk_toolchain = path.join(android_ndk, `toolchains/llvm/prebuilt/${host_tag}`);
				if (host_tag !== '' && fs.existsSync(ndk_toolchain)) {
					defaultArgs.push(`--gcc-toolchain=${ndk_toolchain}`);
					defaultArgs.push(`--sysroot=${ndk_toolchain}/sysroot`);
				}
				else {
					// fallback to the first found toolchain
					let toolchains = fs.readdirSync(path.join(android_ndk, `toolchains/llvm/prebuilt/`));
					if (toolchains.length > 0) {
						let host_tag = toolchains[0];
						let ndk_toolchain = path.join(android_ndk, `toolchains/llvm/prebuilt/${host_tag}`);
						defaultArgs.push(`--gcc-toolchain=${ndk_toolchain}`);
						defaultArgs.push(`--sysroot=${ndk_toolchain}/sysroot`);
						log.info(`Found android ndk toolchain in ${ndk_toolchain}.`);
					}
					else {
						log.error('Platform is set to Android, but android toolchain not found.');
					}
				}
			}
			else {
				log.error('Platform is set to Android, but android toolchain not found.\nPlease set the ANDROID_NDK environment variable if you need a compile_commands.json for your IDE.');
			}
		}
		else if (platform === Platform.Emscripten) {
			let emcc = child_process.spawnSync('emcc', ['--cflags']);
			// log.info(emcc.status);
			if (emcc.status === 0) {
				let flags = emcc.output.toString().split(' ');
				defaultArgs.push(...flags);
			}
			else {
				log.error('Platform is set to Emscripten, but emcc could not be found. Please add it to your PATH environment variable if you need a compile_commands.json for your IDE.');
			}
		}

		let commands = [];
		for (let fileobject of project.getFiles()) {
			let file = fileobject.file;
			if (file.endsWith('.c') || file.endsWith('.cpp') || file.endsWith('.cc')) {
				let args = ['/usr/bin/clang', '-c', '-o', (options.debug ? 'Debug' : 'Release') + ofiles[file] + '.o'];
				if (file.endsWith('.c')) {
					args.push('-std=c99');
				}
				args.push(...defaultArgs);
				args.push(path.resolve(from, file));
				let command = {
					directory: from,
					file: path.resolve(from, file),
					output: path.resolve(to, ofiles[file] + '.o'),
					arguments: args.concat(includes).concat(defines)
				};
				commands.push(command);
			}
		}

		this.p(JSON.stringify(commands));
		this.closeFile();
	}
}
