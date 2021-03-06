/* Magic Mirror
 *
 * MIT Licensed.
 *
 * Redesigned by Răzvan Cristea
 * for iPad 3 & HD display
 * https://github.com/hangorazvan
 */
Module.register("lifecounter", {

	defaults: {
		decimalSymbol: config.decimal,
	},

	getScripts() {
		return ["moment.js"];
	},
	
	start() {
		Log.info("Starting module: " + this.name);
		var self = this;
		setInterval(function() {
			self.updateDom();
		}, 1000);
	},

	getDom() {
		var wrapper = document.createElement("div");
		var yourtime = moment.utc().diff(this.config.birthday, this.config.counter);
		var lifecounter = this.config.before + " " + yourtime + " " + this.config.after;

		if (yourtime > 999395200 && yourtime < 1000086400) { // one week before and one day after
			wrapper.className = "bright " + this.config.cssclass;
		} else {
			wrapper.className = "normal " + this.config.cssclass;
		}

		if (this.config.decimalSymbol == "."){
			wrapper.innerHTML = lifecounter.replace(/\B(?=(\d{3})+(?!\d))/g, ",").replace("-", "");
		} else {
			wrapper.innerHTML = lifecounter.replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace("-", "");
		}
		
		return wrapper;
	}
});