import { Exporter } from 'kmake/Exporters/Exporter';
import { Project } from 'kmake/Project';
import * as fs from 'kmake/fsextra';
import * as path from 'path';

export class NinjaExporter extends Exporter {
	cCompiler: string;
	cppCompiler: string;
	cFlags: string;
	cppFlags: string;
	linkerFlags: string;
	outputExtension: string;

	constructor(options: any, cCompiler: string, cppCompiler: string, cFlags: string, cppFlags: string, linkerFlags: string, outputExtension: string, libsLine: (p: Project) => string = null) {
		super(options);
		this.cCompiler = cCompiler;
		this.cppCompiler = cppCompiler;
		this.cFlags = cFlags;
		this.cppFlags = cppFlags;
		this.linkerFlags = linkerFlags;
		this.outputExtension = outputExtension;
		if (libsLine != null) {
			this.libsLine = libsLine;
		}
	}

	libsLine(project: Project): string {
		let libs = '';
		for (let lib of project.getLibs()) {
			libs += ' -l' + lib;
		}
		return libs;
	}

	async exportSolution(project: Project, from: string, to: string, platform: string, vrApi: any, options: any) {
		let objects: any = {};
		let ofiles: any = {};
		let outputPath = path.resolve(to, options.buildPath);
		fs.ensureDirSync(outputPath);

		for (let fileobject of project.getFiles()) {
			let file = fileobject.file;
			if (file.endsWith('.cpp') || file.endsWith('.c') || file.endsWith('.cc') || file.endsWith('.s') || file.endsWith('.S')) {
				if (fileobject.options && fileobject.options.nocompile) {
					continue;
				}
				
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

		let ofilelist = '';
		for (let o in objects) {
			ofilelist += o + '.o ';
		}

		this.writeFile(path.resolve(outputPath, 'build.ninja'));

		this.p('pool link_pool\n  depth = 1\n');

		let incline = '';
		for (let inc of project.getIncludeDirs()) {
			inc = path.relative(outputPath, path.resolve(from, inc));
			incline += '-I' + inc + ' ';
		}

		let libsline = this.linkerFlags;
		libsline += this.libsLine(project);
		libsline += ' ';

		let defline = '';
		for (const def of project.getDefines()) {
			if (def.config && def.config.toLowerCase() === 'debug' && !options.debug) {
				continue;
			}

			if (def.config && def.config.toLowerCase() === 'release' && options.debug) {
				continue;
			}

			defline += '-D' + def.value.replace(/\"/g, '\\"') + ' ';
		}
		if (!options.debug) {
			defline += '-DNDEBUG ';
		}

		let optimization = '';
		if (!options.debug) {
			optimization = '-O2';
		}
		else optimization = '-g';

		let cline = this.cCompiler + ' ' + this.cFlags + ' ';
		if (project.cStd !== '') {
			cline += '-std=' + project.cStd + ' ';
		}
		if (options.dynlib) {
			cline += '-fPIC ';
		}
		for (let flag of project.cFlags) {
			cline += flag + ' ';
		}
		cline += optimization + ' ';
		cline += incline;
		cline += defline;
		this.p('rule cc\n  deps = gcc\n  depfile = $out.d\n  command = ' + cline + '-MD -MF $out.d -c $in -o $out\n');

		let cppline = this.cppCompiler + ' ' + this.cppFlags + ' ';
		if (project.cppStd !== '') {
			cppline += '-std=' + project.cppStd + ' ';
		}
		if (options.dynlib) {
			cppline += '-fPIC ';
		}
		for (let flag of project.cppFlags) {
			cppline += flag + ' ';
		}
		cppline += optimization + ' ';
		cppline += incline;
		cppline += defline;
		this.p('rule cxx\n  deps = gcc\n  depfile = $out.d\n  command = ' + cppline + '-MD -MF $out.d -c $in -o $out\n');

		if (options.dynlib) {
			this.p('rule link\n  pool = link_pool\n  command = ' + this.cppCompiler + ' -fPIC -shared -o $out ' + optimization + ' $in ' + libsline);
		}
		else if (options.lib) {
			this.p('rule link\n  pool = link_pool\n  command = ar rcs -o $out $in');
		}
		else {
			this.p('rule link\n  pool = link_pool\n  command = ' + this.cppCompiler + ' -o $out ' + optimization + ' $in ' + libsline);
		}

		for (let fileobject of project.getFiles()) {
			let file = fileobject.file;
			if (file.endsWith('.c') || file.endsWith('.cpp') || file.endsWith('.cc') || file.endsWith('.s') || file.endsWith('.S')) {
				if (fileobject.options && fileobject.options.nocompile) {
					continue;
				}

				this.p();
				let name = ofiles[file];
				let realfile = path.relative(outputPath, path.resolve(from, file));

				let compiler = 'cxx';
				if (file.endsWith('.c')) {
					compiler = 'cc';
				}
				else if (file.endsWith('.s') || file.endsWith('.S')) {
					compiler = 'asm';
				}

				this.p('build ' + name + '.o: ' + compiler + ' ' + realfile);
			}
		}
		this.p();

		let executableName = project.getSafeName();
		if (project.getExecutableName()) {
			executableName = project.getExecutableName();
		}

		let outputname = this.outputExtension === '.html' ? 'index.html' : executableName + this.outputExtension;

		this.p('build ' + outputname + ': link ' + ofilelist);

		this.closeFile();
	}
}
