/* Magic Mirror
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 *
 * Redesigned by Răzvan Cristea
 * for iPad 3 & HD display
 * https://github.com/hangorazvan
 */
var Loader = (function () {
	/* Create helper variables */

	var loadedModuleFiles = [];
	var loadedFiles = [];
	var moduleObjects = [];

	/* Private Methods */

	/**
	 * Loops thru all modules and requests load for every module.
	 */
	var loadModules = function () {
		var moduleData = getModuleData();

		var loadNextModule = function () {
			if (moduleData.length > 0) {
				var nextModule = moduleData[0];
				loadModule(nextModule, function () {
					moduleData = moduleData.slice(1);
					loadNextModule();
				});
			} else {
				// All modules loaded. Load custom.css
				// This is done after all the modules so we can
				// overwrite all the defined styles.

				loadFile(config.customCss, function () {
					// custom.css loaded. Start all modules.
					startModules();
				});
			}
		};

		loadNextModule();
	};

	/**
	 * Loops thru all modules and requests start for every module.
	 */
	var startModules = function () {
		for (var m in moduleObjects) {
			var module = moduleObjects[m];
			module.start();
		}

		// Notify core of loaded modules.
		MM.modulesStarted(moduleObjects);
	};

	/**
	 * Retrieve list of all modules.
	 *
	 * @returns {object[]} module data as configured in config
	 */
	var getAllModules = function () {
		return config.modules;
	};

	/**
	 * Generate array with module information including module paths.
	 *
	 * @returns {object[]} Module information.
	 */
	var getModuleData = function () {
		var modules = getAllModules();
		var moduleFiles = [];

		for (var m in modules) {
			var moduleData = modules[m];
			var module = moduleData.module;

			var elements = module.split("/");
			var moduleName = elements[elements.length - 1];
			var moduleFolder = config.paths.modules + "/" + module;

			if (defaultModules.indexOf(moduleName) !== -1) {
				moduleFolder = config.paths.modules + "/default/" + module;
			}

			if (moduleData.disabled === true) {
				continue;
			}

			moduleFiles.push({
				index: m,
				identifier: "module_" + m + "_" + module,
				name: moduleName,
				path: moduleFolder + "/",
				file: moduleName + ".js",
				position: moduleData.position,
				header: moduleData.header,
				configDeepMerge: typeof moduleData.configDeepMerge === "boolean" ? moduleData.configDeepMerge : false,
				config: moduleData.config,
				classes: typeof moduleData.classes !== "undefined" ? moduleData.classes + " " + module : module
			});
		}

		return moduleFiles;
	};

	/**
	 * Load modules via ajax request and create module objects.s
	 *
	 * @param {object} module Information about the module we want to load.
	 * @param {Function} callback Function called when done.
	 */
	var loadModule = function (module, callback) {
		var url = module.path + "/" + module.file;

		var afterLoad = function () {
			var moduleObject = Module.create(module.name);
			if (moduleObject) {
				bootstrapModule(module, moduleObject, function () {
					callback();
				});
			} else {
				callback();
			}
		};

		if (loadedModuleFiles.indexOf(url) !== -1) {
			afterLoad();
		} else {
			loadFile(url, function () {
				loadedModuleFiles.push(url);
				afterLoad();
			});
		}
	};

	/**
	 * Bootstrap modules by setting the module data and loading the scripts & styles.
	 *
	 * @param {object} module Information about the module we want to load.
	 * @param {Module} mObj Modules instance.
	 * @param {Function} callback Function called when done.
	 */
	var bootstrapModule = function (module, mObj, callback) {
		Log.info("Bootstrapping module: " + module.name);

		mObj.setData(module);

		mObj.loadScripts(function () {
			Log.log("Scripts loaded for: " + module.name);
			mObj.loadStyles(function () {
				Log.log("Styles loaded for: " + module.name);
				mObj.loadTranslations(function () {
					Log.log("Translations loaded for: " + module.name);
					moduleObjects.push(mObj);
					callback();
				});
			});
		});
	};

	/**
	 * Load a script or stylesheet by adding it to the dom.
	 *
	 * @param {string} fileName Path of the file we want to load.
	 * @param {Function} callback Function called when done.
	 */
	var loadFile = function (fileName, callback) {
		var extension = fileName.slice((Math.max(0, fileName.lastIndexOf(".")) || Infinity) + 1);

		switch (extension.toLowerCase()) {
			case "js":
				Log.log("Load script: " + fileName);
				var script = document.createElement("script");
				script.type = "text/javascript";
				script.src = fileName;
				script.onload = function () {
					if (typeof callback === "function") {
						callback();
					}
				};
				script.onerror = function () {
					Log.error("Error on loading script:", fileName);
					if (typeof callback === "function") {
						callback();
					}
				};

				document.getElementsByTagName("body")[0].appendChild(script);
				break;
			case "css":
				Log.log("Load stylesheet: " + fileName);
				var stylesheet = document.createElement("link");
				stylesheet.rel = "stylesheet";
				stylesheet.type = "text/css";
				stylesheet.href = fileName;
				stylesheet.onload = function () {
					if (typeof callback === "function") {
						callback();
					}
				};
				stylesheet.onerror = function () {
					Log.error("Error on loading stylesheet:", fileName);
					if (typeof callback === "function") {
						callback();
					}
				};

				document.getElementsByTagName("head")[0].appendChild(stylesheet);
				break;
		}
	};

	/* Public Methods */
	return {
		/**
		 * Load all modules as defined in the config.
		 */
		loadModules: function () {
			loadModules();
		},

		/**
		 * Load a file (script or stylesheet).
		 * Prevent double loading and search for files in the vendor folder.
		 *
		 * @param {string} fileName Path of the file we want to load.
		 * @param {Module} module The module that calls the loadFile function.
		 * @param {Function} callback Function called when done.
		 */
		loadFile: function (fileName, module, callback) {
			if (loadedFiles.indexOf(fileName.toLowerCase()) !== -1) {
				Log.log("File already loaded: " + fileName);
				callback();
				return;
			}

			if (fileName.indexOf("http://") === 0 || fileName.indexOf("https://") === 0 || fileName.indexOf("/") !== -1) {
				// This is an absolute or relative path.
				// Load it and then return.
				loadedFiles.push(fileName.toLowerCase());
				loadFile(fileName, callback);
				return;
			}

			if (vendor[fileName] !== undefined) {
				// This file is available in the vendor folder.
				// Load it from this vendor folder.
				loadedFiles.push(fileName.toLowerCase());
				loadFile(config.paths.vendor + "/" + vendor[fileName], callback);
				return;
			}

			// File not loaded yet.
			// Load it based on the module path.
			loadedFiles.push(fileName.toLowerCase());
			loadFile(module.file(fileName), callback);
		}
	};
})();
