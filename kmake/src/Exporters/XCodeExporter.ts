import { Exporter } from 'kmake/Exporters/Exporter';
import * as Icon from 'kmake/Icon';
import { Platform } from 'kmake/Platform';
import { Project } from 'kmake/Project';
import * as Proj from 'kmake/Project';
import * as fs from 'kmake/fsextra';
import * as path from 'path';
import * as child_process from 'child_process';
import * as crypto from 'crypto';

function uuidv4(): string {
	return crypto.randomUUID();
}

// not quite uuid v5 but close enough
function uuidv5(path: string, namespace: string): string {
	const hash = crypto.createHash('sha1');
	hash.update(namespace);
	hash.update(path);
	const value = hash.digest('hex');
	return value.substring(0, 8) + '-' + value.substring(8, 12) + '-' + value.substring(12, 16) + '-' + value.substring(16, 20) + '-' + value.substring(20, 32);
}

function contains(a: any[], b: any): boolean {
	return a.indexOf(b) !== -1;
}

function newId(): string {
	return uuidv4().toUpperCase();
}

function newPathId(path: string): string {
	return uuidv5(path, '7448ebd8-cfc8-4f45-8b3d-5df577ceea6d').toUpperCase();
}

function getDir(file: Proj.File) {
	if (file.file.indexOf('/') >= 0) {
		let dir = file.file.substr(0, file.file.lastIndexOf('/'));
		return path.join(file.projectName, path.relative(file.projectDir, dir)).replace(/\\/g, '/');
	}
	else {
		return file.projectName;
	}
}

class Directory {
	dirname: string;
	id: string;

	constructor(dirname: string) {
		this.dirname = dirname;
		this.id = newPathId(dirname);
	}

	getName() {
		return this.dirname;
	}

	getLastName() {
		if (this.dirname.indexOf('/') < 0) return this.dirname;
		return this.dirname.substr(this.dirname.lastIndexOf('/') + 1);
	}

	getId() {
		return this.id;
	}
}

class File {
	filename: string;
	dir: Directory;
	buildid: string;
	fileid: string;
	options: any;

	constructor(filename: string, dir: Directory, options: any) {
		this.filename = filename;
		this.dir = dir;
		this.buildid = newPathId(dir + filename + '_buildid');
		this.fileid = newPathId(dir + filename + '_fileid');
		this.options = options;
	}

	getBuildId() {
		return this.buildid;
	}

	getFileId() {
		return this.fileid;
	}

	isBuildFile() {
		const buildFileType = this.filename.endsWith('.c') || this.filename.endsWith('.cpp') || this.filename.endsWith('.m') || this.filename.endsWith('.mm') || this.filename.endsWith('.cc') || this.filename.endsWith('.s') || this.filename.endsWith('S') || this.filename.endsWith('.metal') || this.filename.endsWith('.storyboard');
		if (buildFileType) {
			if (this.options && this.options.nocompile) {
				return false;
			}
		}
		return buildFileType;
	}

	getName() {
		return this.filename;
	}

	getLastName() {
		if (this.filename.indexOf('/') < 0) return this.filename;
		return this.filename.substr(this.filename.lastIndexOf('/') + 1);
	}

	getDir() {
		return this.dir;
	}

	toString() {
		return this.getName();
	}
}

class Framework {
	name: string;
	buildid: string;
	fileid: string;
	localPath: string;

	constructor(name: string) {
		this.name = name;
		this.buildid = newPathId(name + '_buildid');
		this.fileid = newPathId(name + '_fileid');
		this.localPath = null;
	}

	toString() {
		if (this.name.indexOf('.') < 0) return this.name + '.framework';
		else return this.name;
	}

	getBuildId() {
		return this.buildid.toString().toUpperCase();
	}

	getFileId() {
		return this.fileid.toString().toUpperCase();
	}
}

function findDirectory(dirname: string, directories: Directory[]) {
	for (let dir of directories) {
		if (dir.getName() === dirname) {
			return dir;
		}
	}
	return null;
}

function addDirectory(dirname: string, directories: Directory[]) {
	let dir = findDirectory(dirname, directories);
	if (dir === null) {
		dir = new Directory(dirname);
		directories.push(dir);
		while (dirname.indexOf('/') >= 0) {
			dirname = dirname.substr(0, dirname.lastIndexOf('/'));
			addDirectory(dirname, directories);
		}
	}
	return dir;
}

export class XCodeExporter extends Exporter {
	constructor(options: any) {
		super(options);
	}

	exportWorkspace(to: string, project: Project) {
		const dir = path.resolve(to, project.getSafeName() + '.xcodeproj', 'project.xcworkspace');
		fs.ensureDirSync(dir);

		this.writeFile(path.resolve(to, project.getSafeName() + '.xcodeproj', 'project.xcworkspace', 'contents.xcworkspacedata'));

		this.p('<?xml version="1.0" encoding="UTF-8"?>');
		this.p('<Workspace');
		this.p('version = "1.0">');
		this.p('<FileRef');
		this.p('location = "self:' + project.getSafeName() + '.xcodeproj">');
		this.p('</FileRef>');
		this.p('</Workspace>');

		this.closeFile();
	}

	open(project: Project, to: string) {
		child_process.spawn('open', [path.resolve(to, project.getSafeName() + '.xcodeproj')], {detached: true, shell: true});
	}

	async exportSolution(project: Project, from: string, to: string, platform: string, vrApi: any, options: any) {
		const xdir = path.resolve(to, project.getSafeName() + '.xcodeproj');
		fs.ensureDirSync(xdir);

		this.exportWorkspace(to, project);

		let icons: IconImage[] = [];

		class IconImage {
			idiom: string;
			size: number;
			scale: number;
			background: number;

			constructor(idiom: string, size: number, scale: number, background: number = undefined) {
				this.idiom = idiom;
				this.size = size;
				this.scale = scale;
				this.background = background;
			}
		}

		if (platform === Platform.iOS) {
			icons.push(new IconImage('iphone', 20, 2));
			icons.push(new IconImage('iphone', 20, 3));
			icons.push(new IconImage('iphone', 29, 2));
			icons.push(new IconImage('iphone', 29, 3));
			icons.push(new IconImage('iphone', 40, 2));
			icons.push(new IconImage('iphone', 40, 3));
			icons.push(new IconImage('iphone', 60, 2));
			icons.push(new IconImage('iphone', 60, 3));
			icons.push(new IconImage('ipad', 20, 1));
			icons.push(new IconImage('ipad', 20, 2));
			icons.push(new IconImage('ipad', 29, 1));
			icons.push(new IconImage('ipad', 29, 2));
			icons.push(new IconImage('ipad', 40, 1));
			icons.push(new IconImage('ipad', 40, 2));
			icons.push(new IconImage('ipad', 76, 1));
			icons.push(new IconImage('ipad', 76, 2));
			icons.push(new IconImage('ipad', 83.5, 2));
			icons.push(new IconImage('ios-marketing', 1024, 1, 0x000000ff));
		}
		else {
			icons.push(new IconImage('mac', 16, 1));
			icons.push(new IconImage('mac', 16, 2));
			icons.push(new IconImage('mac', 32, 1));
			icons.push(new IconImage('mac', 32, 2));
			icons.push(new IconImage('mac', 128, 1));
			icons.push(new IconImage('mac', 128, 2));
			icons.push(new IconImage('mac', 256, 1));
			icons.push(new IconImage('mac', 256, 2));
			icons.push(new IconImage('mac', 512, 1));
			icons.push(new IconImage('mac', 512, 2));
		}

		const iconsdir = path.resolve(to, 'Images.xcassets', 'AppIcon.appiconset');
		fs.ensureDirSync(iconsdir);

		this.writeFile(path.resolve(to, 'Images.xcassets', 'AppIcon.appiconset', 'Contents.json'));
		this.p('{');
		this.p('"images" : [', 1);
		for (let i = 0; i < icons.length; ++i) {
			const icon = icons[i];
			this.p('{', 2);
			this.p('"idiom" : "' + icon.idiom + '",', 3);
			this.p('"size" : "' + icon.size + 'x' + icon.size + '",', 3);
			this.p('"filename" : "' + icon.idiom + icon.scale + 'x' + icon.size + '.png",', 3);
			this.p('"scale" : "' + icon.scale + 'x"', 3);
			if (i === icons.length - 1) this.p('}', 2);
			else this.p('},', 2);
		}
		this.p('],', 1);
		this.p('"info" : {', 1);
		this.p('"version" : 1,', 2);
		this.p('"author" : "xcode"', 2);
		this.p('}', 1);
		this.p('}');
		this.closeFile();

		// const black = 0xff;
		for (let i = 0; i < icons.length; ++i) {
			const icon = icons[i];
			await Icon.exportPng(project.icon, path.resolve(to, 'Images.xcassets', 'AppIcon.appiconset', icon.idiom + icon.scale + 'x' + icon.size + '.png'), icon.size * icon.scale, icon.size * icon.scale, icon.background, from);
		}

		let plistname = '';
		let files: File[] = [];
		let directories: Directory[] = [];
		for (let fileobject of project.getFiles()) {
			let filename = fileobject.file;
			if (filename.endsWith('.plist')) plistname = filename;
			let dir = addDirectory(getDir(fileobject), directories);
			let file = new File(filename, dir, fileobject.options);
			files.push(file);
		}
		if (plistname.length === 0) throw 'no plist found';

		let frameworks: Framework[] = [];
		for (let lib of project.getLibs()) {
			frameworks.push(new Framework(lib));
		}

		let targetOptions = {
			bundle: 'tech.kode.$(PRODUCT_NAME:rfc1034identifier)',
			version: '1.0',
			build: '1',
			organizationName: 'the Kore Development Team',
			developmentTeam: ''
		};
		if (project.targetOptions && project.targetOptions.ios) {
			let userOptions = project.targetOptions.ios;
			if (userOptions.bundle) targetOptions.bundle = userOptions.bundle;
			if (userOptions.version) targetOptions.version = userOptions.version;
			if (userOptions.build) targetOptions.build = userOptions.build;
			if (userOptions.organizationName) targetOptions.organizationName = userOptions.organizationName;
			if (userOptions.developmentTeam) targetOptions.developmentTeam = userOptions.developmentTeam;
		}

		const projectId = newPathId('_projectId');
		const appFileId = newPathId('_appFileId');
		const frameworkBuildId = newPathId('_frameworkBuildId');
		const sourceBuildId = newPathId('_sourceBuildId');
		const frameworksGroupId = newPathId('_frameworksGroupId');
		const productsGroupId = newPathId('_productsGroupId');
		const mainGroupId = newPathId('_mainGroupId');
		const targetId = newPathId('_targetId');
		const nativeBuildConfigListId = newPathId('_nativeBuildConfigListId');
		const projectBuildConfigListId = newPathId('_projectBuildConfigListId');
		const debugId = newPathId('_debugId');
		const releaseId = newPathId('_releaseId');
		const nativeDebugId = newPathId('_nativeDebugId');
		const nativeReleaseId = newPathId('_nativeReleaseId');
		const debugDirFileId = newPathId('_debugDirFileId');
		const debugDirBuildId = newPathId('_debugDirBuildId');
		const resourcesBuildId = newPathId('_resourcesBuildId');
		const iconFileId = newPathId('_iconFileId');
		const iconBuildId = newPathId('_iconBuildId');
		// var iosIconFileIds = [];
		// var iosIconBuildIds = [];
		// for (var i = 0; i < iosIconNames.length; ++i) {
		//     iosIconFileIds.push(newId());
		//     iosIconBuildIds.push(newId());
		// }

		this.writeFile(path.resolve(to, project.getSafeName() + '.xcodeproj', 'project.pbxproj'));

		this.p('// !$*UTF8*$!');
		this.p('{');
		this.p('archiveVersion = 1;', 1);
		this.p('classes = {', 1);
		this.p('};', 1);
		this.p('objectVersion = 46;', 1);
		this.p('objects = {', 1);
		this.p();
		this.p('/* Begin PBXBuildFile section */');
		for (let framework of frameworks) {
			this.p(framework.getBuildId() + ' /* ' + framework.toString() + ' in Frameworks */ = {isa = PBXBuildFile; fileRef = ' + framework.getFileId() + ' /* ' + framework.toString() + ' */; };', 2);
		}
		this.p(debugDirBuildId + ' /* Deployment in Resources */ = {isa = PBXBuildFile; fileRef = ' + debugDirFileId + ' /* Deployment */; };', 2);
		for (let file of files) {
			if (file.isBuildFile()) {
				this.p(file.getBuildId() + ' /* ' + file.toString() + ' in Sources */ = {isa = PBXBuildFile; fileRef = ' + file.getFileId() + ' /* ' + file.toString() + ' */; };', 2);
			}
		}
		if (!options.lib && !options.dynlib) {
			this.p(iconBuildId + ' /* Images.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = ' + iconFileId + ' /* Images.xcassets */; };', 2);
		}
		this.p('/* End PBXBuildFile section */');
		this.p();
		this.p('/* Begin PBXFileReference section */');

		let executableName = project.getSafeName();
		if (project.getExecutableName()) {
			executableName = project.getExecutableName();
		}

		if (options.lib) {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.a */ = {isa = PBXFileReference; explicitFileType = archive.ar; includeInIndex = 0; path = "' + executableName + '.a"; sourceTree = BUILT_PRODUCTS_DIR; };', 2);
		}
		else if (options.dynlib) {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.dylib */ = {isa = PBXFileReference; explicitFileType = "compiled.mach-o.dylib"; includeInIndex = 0; path = "' + executableName + '.dylib"; sourceTree = BUILT_PRODUCTS_DIR; };', 2);
		}
		else {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "' + executableName + '.app"; sourceTree = BUILT_PRODUCTS_DIR; };', 2);
		}

		for (let framework of frameworks) {
			if (framework.toString().endsWith('.framework')) {
				// Local framework - a directory is specified
				if (framework.toString().indexOf('/') >= 0) {
					framework.localPath = path.resolve(from, framework.toString());
					this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = ' + framework.toString() + '; path = ' + framework.localPath + '; sourceTree = "<absolute>"; };', 2);
				}
				// XCode framework
				else {
					this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = ' + framework.toString() + '; path = System/Library/Frameworks/' + framework.toString() + '; sourceTree = SDKROOT; };', 2);
				}
			}
			else if (framework.toString().endsWith('.dylib')) {
				// Local dylib, e.g. V8 in Krom - a directory is specified
				if (framework.toString().indexOf('/') >= 0) {
					framework.localPath = path.resolve(from, framework.toString());
					this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */ = {isa = PBXFileReference; lastKnownFileType = compiled.mach-o.dylib; name = ' + framework.toString() + '; path = ' + framework.localPath + '; sourceTree = "<absolute>"; };', 2);
				} else {
					this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */ = {isa = PBXFileReference; lastKnownFileType = compiled.mach-o.dylib; name = ' + framework.toString() + '; path = usr/lib/' + framework.toString() + '; sourceTree = SDKROOT; };', 2);
				}
			}
			else {
				framework.localPath = path.resolve(from, framework.toString());
				this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */ = {isa = PBXFileReference; lastKnownFileType = archive.ar; name = ' + framework.toString() + '; path = ' + framework.localPath + '; sourceTree = "<group>"; };', 2);
			}
		}
		this.p(debugDirFileId + ' /* Deployment */ = {isa = PBXFileReference; lastKnownFileType = folder; name = Deployment; path = "' + path.resolve(from, project.getDebugDir()) + '"; sourceTree = "<group>"; };', 2);
		for (let file of files) {
			let filetype = 'unknown';
			let fileencoding = '';
			if (file.getName().endsWith('.storyboard')) filetype = 'file.storyboard';
			if (file.getName().endsWith('.plist')) filetype = 'text.plist.xml';
			if (file.getName().endsWith('.h')) filetype = 'sourcecode.c.h';
			if (file.getName().endsWith('.m')) filetype = 'sourcecode.c.objc';
			if (file.getName().endsWith('.c')) filetype = 'sourcecode.c.c';
			if (file.getName().endsWith('.cpp')) filetype = 'sourcecode.c.cpp';
			if (file.getName().endsWith('.cc')) filetype = 'sourcecode.c.cpp';
			if (file.getName().endsWith('.mm')) filetype = 'sourcecode.c.objcpp';
			if (file.getName().endsWith('.s') || file.getName().endsWith('.S')) filetype = 'sourcecode.asm';
			if (file.getName().endsWith('.metal')) {
				filetype = 'sourcecode.metal';
				fileencoding = 'fileEncoding = 4; ';
			}
			if (!file.getName().endsWith('.DS_Store')) {
				this.p(file.getFileId() + ' /* ' + file.toString() + ' */ = {isa = PBXFileReference; ' + fileencoding + 'lastKnownFileType = ' + filetype + '; name = "' + file.getLastName() + '"; path = "' + path.resolve(from, file.toString()) + '"; sourceTree = "<group>"; };', 2);
			}
		}
		if (!options.lib && !options.dynlib) {
			this.p(iconFileId + ' /* Images.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Images.xcassets; sourceTree = "<group>"; };', 2);
		}
		this.p('/* End PBXFileReference section */');
		this.p();
		this.p('/* Begin PBXFrameworksBuildPhase section */');
		this.p(frameworkBuildId + ' /* Frameworks */ = {', 2);
		this.p('isa = PBXFrameworksBuildPhase;', 3);
		this.p('buildActionMask = 2147483647;', 3);
		this.p('files = (', 3);
		for (let framework of frameworks) {
			this.p(framework.getBuildId() + ' /* ' + framework.toString() + ' in Frameworks */,', 4);
		}
		this.p(');', 3);
		this.p('runOnlyForDeploymentPostprocessing = 0;', 3);
		this.p('};', 2);
		this.p('/* End PBXFrameworksBuildPhase section */');
		this.p();
		this.p('/* Begin PBXGroup section */');
		this.p(mainGroupId + ' = {', 2);
		this.p('isa = PBXGroup;', 3);
		this.p('children = (', 3);
		if (!options.lib && !options.dynlib) {
			this.p(iconFileId + ' /* Images.xcassets */,', 4);
		}
		this.p(debugDirFileId + ' /* Deployment */,', 4);
		// p(solutionGroupId + " /* " + solution.getName() + " */,", 4);
		for (let dir of directories) {
			if (dir.getName().indexOf('/') < 0) this.p(dir.getId() + ' /* ' + dir.getName() + ' */,', 4);
		}
		this.p(frameworksGroupId + ' /* Frameworks */,', 4);
		this.p(productsGroupId + ' /* Products */,', 4);
		this.p(');', 3);
		this.p('sourceTree = "<group>";', 3);
		this.p('};', 2);
		this.p(productsGroupId + ' /* Products */ = {', 2);
		this.p('isa = PBXGroup;', 3);
		this.p('children = (', 3);
		if (options.lib) {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.a */,', 4);
		}
		else if (options.dynlib) {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.dynlib */,', 4);
		}
		else {
			this.p(appFileId + ' /* ' + project.getSafeName() + '.app */,', 4);
		}
		this.p(');', 3);
		this.p('name = Products;', 3);
		this.p('sourceTree = "<group>";', 3);
		this.p('};', 2);
		this.p(frameworksGroupId + ' /* Frameworks */ = {', 2);
		this.p('isa = PBXGroup;', 3);
		this.p('children = (', 3);
		for (let framework of frameworks) {
			this.p(framework.getFileId() + ' /* ' + framework.toString() + ' */,', 4);
		}
		this.p(');', 3);
		this.p('name = Frameworks;', 3);
		this.p('sourceTree = "<group>";', 3);
		this.p('};', 2);
		for (let dir of directories) {
			this.p(dir.getId() + ' /* ' + dir.getName() + ' */ = {', 2);
			this.p('isa = PBXGroup;', 3);
			this.p('children = (', 3);
			for (let dir2 of directories) {
				if (dir2 === dir) continue;
				if (dir2.getName().startsWith(dir.getName())) {
					if (dir2.getName().substr(dir.getName().length + 1).indexOf('/') < 0)
						this.p(dir2.getId() + ' /* ' + dir2.getName() + ' */,', 4);
				}
			}
			for (let file of files) {
				if (file.getDir() === dir && !file.getName().endsWith('.DS_Store')) this.p(file.getFileId() + ' /* ' + file.toString() + ' */,', 4);
			}
			this.p(');', 3);
			if (dir.getName().indexOf('/') < 0) {
				this.p('path = ../;', 3);
				this.p('name = "' + dir.getLastName() + '";', 3);
			}
			else this.p('name = "' + dir.getLastName() + '";', 3);
			this.p('sourceTree = "<group>";', 3);
			this.p('};', 2);
		}
		this.p('/* End PBXGroup section */');
		this.p();
		this.p('/* Begin PBXNativeTarget section */');
		this.p(targetId + ' /* ' + project.getSafeName() + ' */ = {', 2);
		this.p('isa = PBXNativeTarget;', 3);
		this.p('buildConfigurationList = ' + nativeBuildConfigListId + ' /* Build configuration list for PBXNativeTarget "' + project.getSafeName() + '" */;', 3);
		this.p('buildPhases = (', 3);
		this.p(sourceBuildId + ' /* Sources */,', 4);
		this.p(frameworkBuildId + ' /* Frameworks */,', 4);
		this.p(resourcesBuildId + ' /* Resources */,', 4);
		this.p(');', 3);
		this.p('buildRules = (', 3);
		this.p(');', 3);
		this.p('dependencies = (', 3);
		this.p(');', 3);
		this.p('name = "' + project.getName() + '";', 3);
		this.p('productName = "' + project.getName() + '";', 3);
		if (options.lib) {
			this.p('productReference = ' + appFileId + ' /* ' + project.getSafeName() + '.a */;', 3);
			this.p('productType = "com.apple.product-type.library.static";', 3);
		}
		else if (options.dynlib) {
			this.p('productReference = ' + appFileId + ' /* ' + project.getSafeName() + '.dylib */;', 3);
			this.p('productType = "com.apple.product-type.library.dynamic";', 3);
		}
		else {
			this.p('productReference = ' + appFileId + ' /* ' + project.getSafeName() + '.app */;', 3);
			this.p('productType = "com.apple.product-type.' + (project.isCmd() ? 'tool' : 'application') + '";', 3);
		}
		this.p('};', 2);
		this.p('/* End PBXNativeTarget section */');
		this.p();
		this.p('/* Begin PBXProject section */');
		this.p(projectId + ' /* Project object */ = {', 2);
		this.p('isa = PBXProject;', 3);
		this.p('attributes = {', 3);
		this.p('LastUpgradeCheck = 1230;', 4);
		this.p('ORGANIZATIONNAME = "' + targetOptions.organizationName + '";', 4);
		this.p('TargetAttributes = {', 4);
		this.p(targetId + ' = {', 5);
		this.p('CreatedOnToolsVersion = 6.1.1;', 6);
		if (targetOptions.developmentTeam) {
			this.p('DevelopmentTeam = ' + targetOptions.developmentTeam + ';', 6);
		}
		this.p('};', 5);
		this.p('};', 4);
		this.p('};', 3);
		this.p('buildConfigurationList = ' + projectBuildConfigListId + ' /* Build configuration list for PBXProject "' + project.getSafeName() + '" */;', 3);
		this.p('compatibilityVersion = "Xcode 3.2";', 3);
		this.p('developmentRegion = en;', 3);
		this.p('hasScannedForEncodings = 0;', 3);
		this.p('knownRegions = (', 3);
		this.p('en,', 4);
		this.p('Base,', 4);
		this.p(');', 3);
		this.p('mainGroup = ' + mainGroupId + ';', 3);
		this.p('productRefGroup = ' + productsGroupId + ' /* Products */;', 3);
		this.p('projectDirPath = "";', 3);
		this.p('projectRoot = "";', 3);
		this.p('targets = (', 3);
		this.p(targetId + ' /* ' + project.getSafeName() + ' */,', 4);
		this.p(');', 3);
		this.p('};', 2);
		this.p('/* End PBXProject section */');
		this.p();
		if (!options.lib && !options.dynlib) {
			this.p('/* Begin PBXResourcesBuildPhase section */');
			this.p(resourcesBuildId + ' /* Resources */ = {', 2);
			this.p('isa = PBXResourcesBuildPhase;', 3);
			this.p('buildActionMask = 2147483647;', 3);
			this.p('files = (', 3);
			this.p(debugDirBuildId + ' /* Deployment in Resources */,', 4);
			this.p(iconBuildId + ' /* Images.xcassets in Resources */,', 4);
			this.p(');', 3);
			this.p('runOnlyForDeploymentPostprocessing = 0;', 3);
			this.p('};', 2);
			this.p('/* End PBXResourcesBuildPhase section */');
			this.p();
		}
		this.p('/* Begin PBXSourcesBuildPhase section */');
		this.p(sourceBuildId + ' /* Sources */ = {', 2);
		this.p('isa = PBXSourcesBuildPhase;', 3);
		this.p('buildActionMask = 2147483647;', 3);
		this.p('files = (', 3);
		for (let file of files) {
			if (file.isBuildFile())
				this.p(file.getBuildId() + ' /* ' + file.toString() + ' in Sources */,', 4);
		}
		this.p(');', 3);
		this.p('runOnlyForDeploymentPostprocessing = 0;');
		this.p('};');
		this.p('/* End PBXSourcesBuildPhase section */');
		this.p();
		// p("/* Begin PBXVariantGroup section */");
		// p("E1FC77F013DAA40000D635AE /* InfoPlist.strings */ = {", 2);
		//     p("isa = PBXVariantGroup;", 3);
		//     p("children = (", 3);
		//         p("E1FC77F113DAA40000D635AE /* en */,", 4);
		//     p(");", 3);
		//     p("name = InfoPlist.strings;", 3);
		//     p("sourceTree = \"<group>\";", 3);
		// p("};", 2);
		// p("E1FC77F913DAA40000D635AE /* MainWindow.xib */ = {", 2);
		//     p("isa = PBXVariantGroup;", 3);
		//     p("children = (", 3);
		//         p("E1FC77FA13DAA40000D635AE /* en */,", 4);
		//     p(");", 3);
		//     p("name = MainWindow.xib;", 3);
		//     p("sourceTree = \"<group>\";", 3);
		// p("};", 2);
		// p("E1FC780613DAA40000D635AE /* TestViewController.xib */ = {", 2);
		//     p("isa = PBXVariantGroup;", 3);
		//     p("children = (", 3);
		//         p("E1FC780713DAA40000D635AE /* en */,", 4);
		//     p(");", 3);
		//     p("name = TestViewController.xib;", 3);
		//     p("sourceTree = \"<group>\";", 3);
		// p("};", 2);
		// p("/* End PBXVariantGroup section */");
		// p();
		this.p('/* Begin XCBuildConfiguration section */');
		this.p(debugId + ' /* Debug */ = {', 2);
		this.p('isa = XCBuildConfiguration;', 3);
		this.p('buildSettings = {', 3);
		this.p('ALWAYS_SEARCH_USER_PATHS = NO;', 4);
		if (project.cppStd !== '' && project.cppStd !== 'gnu++14') {
			this.p('CLANG_CXX_LANGUAGE_STANDARD = "' + project.cppStd + '";', 4);
		}
		else {
			this.p('CLANG_CXX_LANGUAGE_STANDARD = "gnu++14";', 4);
		}
		this.p('CLANG_CXX_LIBRARY = "compiler-default";', 4);
		this.p('CLANG_ENABLE_MODULES = YES;', 4);
		this.p('CLANG_ENABLE_OBJC_ARC = YES;', 4);
		this.p('CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;', 4);
		this.p('CLANG_WARN_BOOL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_COMMA = YES;', 4);
		this.p('CLANG_WARN_CONSTANT_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;', 4);
		this.p('CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;', 4);
		this.p('CLANG_WARN_EMPTY_BODY = YES;', 4);
		this.p('CLANG_WARN_ENUM_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_INFINITE_RECURSION = YES;', 4);
		this.p('CLANG_WARN_INT_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;', 4);
		this.p('CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;', 4);
		this.p('CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;', 4);
		this.p('CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;', 4);
		this.p('CLANG_WARN_STRICT_PROTOTYPES = YES;', 4);
		this.p('CLANG_WARN_SUSPICIOUS_MOVE = YES;', 4);
		this.p('CLANG_WARN_UNREACHABLE_CODE = YES;', 4);
		this.p('CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;', 4);

		if (platform === Platform.iOS) {
			this.p('"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";', 4);
		}
		else {
			this.p('CODE_SIGN_IDENTITY = "-";', 4);
		}
		this.p('COPY_PHASE_STRIP = NO;', 4);
		this.p('ENABLE_STRICT_OBJC_MSGSEND = YES;', 4);
		this.p('ENABLE_TESTABILITY = YES;', 4);
		if (project.cStd !== '' && project.cStd !== 'c99') {
			this.p('GCC_C_LANGUAGE_STANDARD = "' + project.cStd + '";', 4);
		}
		else {
			this.p('GCC_C_LANGUAGE_STANDARD = "gnu99";', 4);
		}
		this.p('GCC_DYNAMIC_NO_PIC = NO;', 4);
		this.p('GCC_NO_COMMON_BLOCKS = YES;', 4);
		this.p('GCC_OPTIMIZATION_LEVEL = 0;', 4);
		this.p('GCC_PREPROCESSOR_DEFINITIONS = (', 4);
		this.p('"DEBUG=1",', 5);
		for (const define of project.getDefines()) {
			if (define.config && define.config.toLowerCase() === 'release') {
				continue;
			}
			if (define.value.indexOf('=') >= 0) this.p('"' + define.value.replace(/\"/g, '\\\\\\"') + '",', 5);
			else this.p(define.value + ',', 5);
		}
		this.p('"$(inherited)",', 5);
		this.p(');', 4);
		this.p('GCC_SYMBOLS_PRIVATE_EXTERN = NO;', 4);
		this.p('GCC_WARN_64_TO_32_BIT_CONVERSION = YES;', 4);
		this.p('GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;', 4);
		this.p('GCC_WARN_UNDECLARED_SELECTOR = YES;', 4);
		this.p('GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;', 4);
		this.p('GCC_WARN_UNUSED_FUNCTION = YES;', 4);
		this.p('GCC_WARN_UNUSED_VARIABLE = YES;', 4);
		if (platform === Platform.iOS) {
			this.p('IPHONEOS_DEPLOYMENT_TARGET = 15.6;', 4);
		}
		else {
			this.p('MACOSX_DEPLOYMENT_TARGET = 11.5;', 4);
		}
		this.p('MTL_ENABLE_DEBUG_INFO = YES;', 4);
		this.p('ONLY_ACTIVE_ARCH = YES;', 4);
		if (platform === Platform.iOS) {
			this.p('SDKROOT = iphoneos;', 4);
			this.p('TARGETED_DEVICE_FAMILY = "1,2";', 4);
		}
		else {
			this.p('SDKROOT = macosx;', 4);
		}
		this.p('};', 3);
		this.p('name = Debug;', 3);
		this.p('};', 2);
		this.p(releaseId + ' /* Release */ = {', 2);
		this.p('isa = XCBuildConfiguration;', 3);
		this.p('buildSettings = {', 3);
		this.p('ALWAYS_SEARCH_USER_PATHS = NO;', 4);
		if (project.cppStd !== '' && project.cppStd !== 'gnu++14') {
			this.p('CLANG_CXX_LANGUAGE_STANDARD = "' + project.cppStd + '";', 4);
		}
		else {
			this.p('CLANG_CXX_LANGUAGE_STANDARD = "gnu++14";', 4);
		}
		this.p('CLANG_CXX_LIBRARY = "compiler-default";', 4);
		this.p('CLANG_ENABLE_MODULES = YES;', 4);
		this.p('CLANG_ENABLE_OBJC_ARC = YES;', 4);
		this.p('CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;', 4);
		this.p('CLANG_WARN_BOOL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_COMMA = YES;', 4);
		this.p('CLANG_WARN_CONSTANT_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;', 4);
		this.p('CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;', 4);
		this.p('CLANG_WARN_EMPTY_BODY = YES;', 4);
		this.p('CLANG_WARN_ENUM_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_INFINITE_RECURSION = YES;', 4);
		this.p('CLANG_WARN_INT_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;', 4);
		this.p('CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;', 4);
		this.p('CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;', 4);
		this.p('CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;', 4);
		this.p('CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;', 4);
		this.p('CLANG_WARN_STRICT_PROTOTYPES = YES;', 4);
		this.p('CLANG_WARN_SUSPICIOUS_MOVE = YES;', 4);
		this.p('CLANG_WARN_UNREACHABLE_CODE = YES;', 4);
		this.p('CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;', 4);

		if (platform === Platform.iOS) {
			this.p('"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";', 4);
		}
		else {
			this.p('CODE_SIGN_IDENTITY = "-";', 4);
		}
		this.p('COPY_PHASE_STRIP = YES;', 4);
		if (platform === Platform.OSX) {
			this.p('DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";', 4);
		}
		this.p('ENABLE_NS_ASSERTIONS = NO;', 4);
		this.p('ENABLE_STRICT_OBJC_MSGSEND = YES;', 4);
		if (project.cStd !== '' && project.cStd !== 'c99') {
			this.p('GCC_C_LANGUAGE_STANDARD = "' + project.cStd + '";', 4);
		}
		else {
			this.p('GCC_C_LANGUAGE_STANDARD = "gnu99";', 4);
		}
		this.p('GCC_NO_COMMON_BLOCKS = YES;', 4);
		this.p('GCC_PREPROCESSOR_DEFINITIONS = (', 4);
		this.p('NDEBUG,', 5);
		for (const define of project.getDefines()) {
			if (define.config && define.config.toLowerCase() === 'debug') {
				continue;
			}
			if (define.value.indexOf('=') >= 0) this.p('"' + define.value.replace(/\"/g, '\\\\\\"') + '",', 5);
			else this.p(define.value + ',', 5);
		}
		this.p('"$(inherited)",', 5);
		this.p(');', 4);
		this.p('GCC_WARN_64_TO_32_BIT_CONVERSION = YES;', 4);
		this.p('GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;', 4);
		this.p('GCC_WARN_UNDECLARED_SELECTOR = YES;', 4);
		this.p('GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;', 4);
		this.p('GCC_WARN_UNUSED_FUNCTION = YES;', 4);
		this.p('GCC_WARN_UNUSED_VARIABLE = YES;', 4);
		if (platform === Platform.iOS) {
			this.p('IPHONEOS_DEPLOYMENT_TARGET = 15.6;', 4);
		}
		else {
			this.p('MACOSX_DEPLOYMENT_TARGET = 11.5;', 4);
		}
		this.p('MTL_ENABLE_DEBUG_INFO = NO;', 4);
		if (platform === Platform.iOS) {
			this.p('SDKROOT = iphoneos;', 4);
			this.p('TARGETED_DEVICE_FAMILY = "1,2";', 4);
			this.p('VALIDATE_PRODUCT = YES;', 4);
		}
		else {
			this.p('SDKROOT = macosx;', 4);
		}
		this.p('};', 3);
		this.p('name = Release;', 3);
		this.p('};', 2);

		this.p(nativeDebugId + ' /* Debug */ = {', 2);
		this.p('isa = XCBuildConfiguration;', 3);
		this.p('buildSettings = {', 3);
		if (project.macOSnoArm) {
			this.p('ARCHS = x86_64;', 4);
		}
		if (!options.lib && !options.dynlib) {
			this.p('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;', 4);
		}
		if (platform === Platform.OSX && (!options.lib && !options.dynlib)) {
			this.p('COMBINE_HIDPI_IMAGES = YES;', 4);
		}

		this.p('FRAMEWORK_SEARCH_PATHS = (', 4);
		this.p('"$(inherited)",', 5);
		// Search paths to local frameworks
		for (let framework of frameworks) {
			if (framework.localPath != null) this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
		}
		this.p(');', 4);
		this.p('HEADER_SEARCH_PATHS = (', 4);
		this.p('"$(inherited)",', 5);
		this.p('"/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/include",', 5);
		for (let projectpath of project.getIncludeDirs()) this.p('"' + path.resolve(from, projectpath).replace(/ /g, '\\\\ ') + '",', 5);
		this.p(');', 4);

		this.p('LIBRARY_SEARCH_PATHS = (', 4);
		for (let framework of frameworks) {
			if ((framework.toString().endsWith('.dylib') || framework.toString().endsWith('.a')) && framework.localPath != null) {
				this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
			}
		}
		this.p(');', 4);

		if (!options.lib && !options.dynlib) {
			this.p('INFOPLIST_EXPAND_BUILD_SETTINGS = "YES";', 4);
			this.p('INFOPLIST_FILE = "' + path.resolve(from, plistname) + '";', 4);

			this.p('LD_RUNPATH_SEARCH_PATHS = (', 4);
			this.p('"$(inherited)",', 5);
			if (platform === Platform.iOS) {
				this.p('"@executable_path/Frameworks",', 5);
			}
			for (let framework of frameworks) {
				if (framework.toString().endsWith('.dylib') && framework.localPath != null) {
					this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
				}
			}
			this.p(');', 4);
		}

		if (project.cFlags.length > 0) {
			this.p('OTHER_CFLAGS = (', 4);
			for (let cFlag of project.cFlags) {
				this.p('"' + cFlag + '",', 5);
			}
			this.p(');', 4);
		}

		if (project.cppFlags.length > 0) {
			this.p('OTHER_CPLUSPLUSFLAGS = (', 4);
			for (let cppFlag of project.cppFlags) {
				this.p('"' + cppFlag + '",', 5);
			}
			this.p(');', 4);
		}

		if (options.dynlib) {
			this.p('DYLIB_COMPATIBILITY_VERSION = 1;', 4);
			this.p('DYLIB_CURRENT_VERSION = 1;', 4);
			this.p('EXECUTABLE_PREFIX = lib;', 4);
		}
		else if (options.lib) {
			this.p('EXECUTABLE_PREFIX = lib;', 4);
		}

		if (!options.lib && !options.dynlib) {
			this.p('PRODUCT_BUNDLE_IDENTIFIER = "' + targetOptions.bundle + '";', 4);
		}
		this.p('BUNDLE_VERSION = "' + targetOptions.version + '";', 4);
		this.p('BUILD_VERSION = "' + targetOptions.build + '";', 4);
		this.p('CODE_SIGN_IDENTITY = "-";', 4);
		this.p('PRODUCT_NAME = "$(TARGET_NAME)";', 4);
		if (options.lib) {
			// this.p('MACH_O_TYPE = staticlib;', 4);
			// this.p('STRIP_INSTALLED_PRODUCT = NO;', 4);
			this.p('SKIP_INSTALL = YES;', 4);
		}
		else if (options.dynlib) {
			// this.p('MACH_O_TYPE = mh_dylib;', 4);
			// this.p('STRIP_STYLE = debugging;', 4);
			this.p('SKIP_INSTALL = YES;', 4);
		}
		this.p('};', 3);
		this.p('name = Debug;', 3);
		this.p('};', 2);
		this.p(nativeReleaseId + ' /* Release */ = {', 2);
		this.p('isa = XCBuildConfiguration;', 3);
		this.p('buildSettings = {', 3);
		if (project.macOSnoArm) {
			this.p('ARCHS = x86_64;', 4);
		}
		if (!options.lib && !options.dynlib) {
			this.p('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;', 4);
		}
		if (platform === Platform.OSX && (!options.lib && !options.dynlib)) {
			this.p('COMBINE_HIDPI_IMAGES = YES;', 4);
		}

		this.p('"EXCLUDED_SOURCE_FILE_NAMES[arch=*]" = (', 4);
		for (let fileobject of project.getFiles()) {
			let file = fileobject.file;
			if (file.endsWith('.cpp') || file.endsWith('.c') || file.endsWith('.cc') || file.endsWith('.cxx') || file.endsWith('.m') || file.endsWith('.mm')) {
				if (fileobject.options && fileobject.options.nocompile) {
					this.p('"' + file + '",', 5);
				}
			}
		}
		this.p(');', 4);

		this.p('FRAMEWORK_SEARCH_PATHS = (', 4);
		this.p('"$(inherited)",', 5);
		// Search paths to local frameworks
		for (let framework of frameworks) {
			if (framework.localPath != null) this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
		}
		this.p(');', 4);
		this.p('HEADER_SEARCH_PATHS = (', 4);
		this.p('"$(inherited)",', 5);
		this.p('"/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/include",', 5);
		for (let p of project.getIncludeDirs()) this.p('"' + path.resolve(from, p).replace(/ /g, '\\\\ ') + '",', 5);
		this.p(');', 4);

		this.p('LIBRARY_SEARCH_PATHS = (', 4);
		for (let framework of frameworks) {
			if ((framework.toString().endsWith('.dylib') || framework.toString().endsWith('.a')) && framework.localPath != null) {
				this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
			}
		}
		this.p(');', 4);

		if (!options.lib && !options.dynlib) {
			this.p('INFOPLIST_EXPAND_BUILD_SETTINGS = "YES";', 4);
			this.p('INFOPLIST_FILE = "' + path.resolve(from, plistname) + '";', 4);
			this.p('LD_RUNPATH_SEARCH_PATHS = (', 4);
			this.p('"$(inherited)",', 5);
			if (platform === Platform.iOS) {
				this.p('"@executable_path/Frameworks",', 5);
			}
			for (let framework of frameworks) {
				if (framework.toString().endsWith('.dylib') && framework.localPath != null) {
					this.p(framework.localPath.substr(0, framework.localPath.lastIndexOf('/')) + ',', 5);
				}
			}
			this.p(');', 4);
		}

		if (project.cFlags.length > 0) {
			this.p('OTHER_CFLAGS = (', 4);
			for (let cFlag of project.cFlags) {
				this.p('"' + cFlag + '",', 5);
			}
			this.p(');', 4);
		}

		if (project.cppFlags.length > 0) {
			this.p('OTHER_CPLUSPLUSFLAGS = (', 4);
			for (let cppFlag of project.cppFlags) {
				this.p('"' + cppFlag + '",', 5);
			}
			this.p(');', 4);
		}

		if (options.dynlib) {
			this.p('DYLIB_COMPATIBILITY_VERSION = 1;', 4);
			this.p('DYLIB_CURRENT_VERSION = 1;', 4);
			this.p('EXECUTABLE_PREFIX = lib;', 4);
		}
		else if (options.lib) {
			this.p('EXECUTABLE_PREFIX = lib;', 4);
		}

		if (!options.lib && !options.dynlib) {
			this.p('PRODUCT_BUNDLE_IDENTIFIER = "' + targetOptions.bundle + '";', 4);
		}
		this.p('BUNDLE_VERSION = "' + targetOptions.version + '";', 4);
		this.p('BUILD_VERSION = "' + targetOptions.build + '";', 4);
		this.p('CODE_SIGN_IDENTITY = "-";', 4);
		this.p('PRODUCT_NAME = "$(TARGET_NAME)";', 4);
		if (options.lib) {
			// this.p('MACH_O_TYPE = staticlib;', 4);
			// this.p('STRIP_INSTALLED_PRODUCT = NO;', 4);
			this.p('SKIP_INSTALL = YES;', 4);
		}
		else if (options.dynlib) {
			// this.p('MACH_O_TYPE = mh_dylib;', 4);
			// this.p('STRIP_STYLE = debugging;', 4);
			this.p('SKIP_INSTALL = YES;', 4);
		}
		this.p('};', 3);
		this.p('name = Release;', 3);
		this.p('};', 2);
		this.p('/* End XCBuildConfiguration section */');
		this.p();
		this.p('/* Begin XCConfigurationList section */');
		this.p(projectBuildConfigListId + ' /* Build configuration list for PBXProject "' + project.getSafeName() + '" */ = {', 2);
		this.p('isa = XCConfigurationList;', 3);
		this.p('buildConfigurations = (', 3);
		this.p(debugId + ' /* Debug */,', 4);
		this.p(releaseId + ' /* Release */,', 4);
		this.p(');', 3);
		this.p('defaultConfigurationIsVisible = 0;', 3);
		this.p('defaultConfigurationName = Release;', 3);
		this.p('};', 2);
		this.p(nativeBuildConfigListId + ' /* Build configuration list for PBXNativeTarget "' + project.getSafeName() + '" */ = {', 2);
		this.p('isa = XCConfigurationList;', 3);
		this.p('buildConfigurations = (', 3);
		this.p(nativeDebugId + ' /* Debug */,', 4);
		this.p(nativeReleaseId + ' /* Release */,', 4);
		this.p(');', 3);
		this.p('defaultConfigurationIsVisible = 0;', 3);
		this.p('defaultConfigurationName = Release;', 3);
		this.p('};', 2);
		this.p('/* End XCConfigurationList section */');
		this.p('};', 1);
		this.p('rootObject = ' + projectId + ' /* Project object */;', 1);
		this.p('}');
		this.closeFile();
	}
}
