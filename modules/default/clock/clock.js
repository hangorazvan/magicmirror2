/* global SunCalc */

/* Magic Mirror
 * Module: Clock
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("clock", {
	// Module config defaults.
	defaults: {
	    timeFormat: config.timeFormat,
	    timezone: config.timezone,
        lat: config.latitude,
		lon: config.longitude,
		showPeriod: config.period,
		showPeriodUpper: config.period,
	},
	// Define required scripts.
	getScripts() {
		return ["moment.js", "moment-timezone.js", "suncalc.js"];
	},
	// Define styles.
	getStyles() {
		return false;
	},
	// Define start sequence.
	start() {
		Log.info("Starting module: " + this.name);

		// Schedule update interval.
		var self = this;
		self.second = moment().second();
		self.minute = moment().minute();

		//Calculate how many ms should pass until next update depending on if seconds is displayed or not
		var delayCalculator = function (reducedSeconds) {
			var EXTRA_DELAY = 50; //Deliberate imperceptable delay to prevent off-by-one timekeeping errors

			if (self.config.displaySeconds) {
				return 1000 - moment().milliseconds() + EXTRA_DELAY;
			} else {
				return (60 - reducedSeconds) * 1000 - moment().milliseconds() + EXTRA_DELAY;
			}
		};

		//A recursive timeout function instead of interval to avoid drifting
		var notificationTimer = function () {
			self.updateDom();

			//If seconds is displayed CLOCK_SECOND-notification should be sent (but not when CLOCK_MINUTE-notification is sent)
			if (self.config.displaySeconds) {
				self.second = moment().second();
				if (self.second !== 0) {
					self.sendNotification("CLOCK_SECOND", self.second);
					setTimeout(notificationTimer, delayCalculator(0));
					return;
				}
			}

			//If minute changed or seconds isn't displayed send CLOCK_MINUTE-notification
			self.minute = moment().minute();
			self.sendNotification("CLOCK_MINUTE", self.minute);
			setTimeout(notificationTimer, delayCalculator(0));
		};

		//Set the initial timeout with the amount of seconds elapsed as reducedSeconds so it will trigger when the minute changes
		setTimeout(notificationTimer, delayCalculator(self.second));

		// Set locale.
		if (config.language == "ro") {
			moment.updateLocale(config.language, {
				months : [
					"Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie",
					"August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"
				],
				weekdays : [
					"Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"
				]
			});
		} else moment.locale(config.language);
	},
	// Override dom generator.
	getDom() {
		var wrapper = document.createElement("div");

		/************************************
		 * Create wrappers for DIGITAL clock
		 */

		var dateWrapper = document.createElement("div");
		var timeWrapper = document.createElement("div");
		var secondsWrapper = document.createElement("span");
		var periodWrapper = document.createElement("span");
		var sunWrapper = document.createElement("div");
		var moonWrapper = document.createElement("div");
		var weekWrapper = document.createElement("div");
		// Style Wrappers
		dateWrapper.className = "date normal xmedium";
		timeWrapper.className = "time bright xlarge light";
		secondsWrapper.className = "seconds dimmed";
		sunWrapper.className = "sun dimmed xmedium";
		moonWrapper.className = "moon dimmed xmedium";
		weekWrapper.className = "week dimmed ssmall";

		// Set content of wrappers.
		// The moment().format("h") method has a bug on the Raspberry Pi.
		// So we need to generate the timestring manually.
		// See issue: https://github.com/MichMich/MagicMirror/issues/181
		var timeString;
		var now = moment();
		this.lastDisplayedMinute = now.minute();
		if (this.config.timezone) {
			now.tz(this.config.timezone);
		}

		var hourSymbol = "HH";
		if (this.config.timeFormat !== 24) {
			hourSymbol = "h";
		}

		if (this.config.clockBold === true) {
			timeString = now.format(hourSymbol + "[<span class=\"bold\">]mm[</span>]");
		} else {
			timeString = now.format(hourSymbol + ":mm");
		}

		if (this.config.showDate) {
			dateWrapper.innerHTML = now.format(this.config.dateFormat);
		}
		if (this.config.showWeek) {
			weekWrapper.innerHTML = this.translate("WEEK", { weekNumber: now.week() }) + ", " + this.translate("DAY", { dayNumber: now.dayOfYear() }) 
			+ ", " + now.format("z") + " " + config.language.toUpperCase() + ", " + config.location;
		}
		timeWrapper.innerHTML = timeString;
		secondsWrapper.innerHTML = now.format(":ss");
		if (this.config.showPeriodUpper) {
			periodWrapper.innerHTML = now.format("A");
		} else {
			periodWrapper.innerHTML = now.format("a");
		}
		if (this.config.displaySeconds) {
			timeWrapper.appendChild(secondsWrapper);
		}
		if (this.config.showPeriod && this.config.timeFormat !== 24) {
			timeWrapper.appendChild(periodWrapper);
		}

		/**
		 * Format the time according to the config
		 *
		 * @param {object} config The config of the module
		 * @param {object} time time to format
		 * @returns {string} The formatted time string
		 */
		function formatTime(config, time) {
			var formatString = hourSymbol + ":mm";
			if (config.showPeriod && config.timeFormat !== 24) {
				formatString += config.showPeriodUpper ? "A" : "a";
			}
			return moment(time).format(formatString);
		}

		if (this.config.showSunTimes) {
			var sunTimes = SunCalc.getTimes(now, this.config.lat, this.config.lon);
			var isVisible = now.isBetween(sunTimes.sunrise, sunTimes.sunset);
			var nextEvent;
			if (now.isBefore(sunTimes.sunrise)) {
				nextEvent = sunTimes.sunrise;
			} else if (now.isBefore(sunTimes.sunset)) {
				nextEvent = sunTimes.sunset;
			} else {
				var tomorrowSunTimes = SunCalc.getTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				nextEvent = tomorrowSunTimes.sunrise;
			}
			var untilNextEvent = moment.duration(moment(nextEvent).diff(now));
			var untilNextEventString = untilNextEvent.hours() + "h " + untilNextEvent.minutes() + "'";

			if (untilNextEvent.hours() === 0) {untilNextEventString = untilNextEvent.minutes() + " min";}
			if (untilNextEvent.hours() === 0 && untilNextEvent.minutes() === 0 && now.hours() > 12) {untilNextEventString = this.translate("Sunset");}
			if (untilNextEvent.hours() === 0 && untilNextEvent.minutes() === 0 && now.hours() < 12) {untilNextEventString = this.translate("Sunrise");}

			sunWrapper.innerHTML = "<span class=\"" + (isVisible ? "bright" : "dimmed") + "\"><i class=\"wi wi-day-sunny\"></i> " + untilNextEventString + "</span>" +
				"<span><i class=\"wi wi-sunrise\"></i> " + formatTime(this.config, sunTimes.sunrise) + "</span>" +
				"<span><i class=\"wi wi-sunset\"></i> " + formatTime(this.config, sunTimes.sunset) + "</span>";
		}
		if (this.config.showMoonTimes) {
			var moonIllumination = SunCalc.getMoonIllumination(now.toDate());
			var moonTimes = SunCalc.getMoonTimes(now, this.config.lat, this.config.lon);
//			var moonRise = moonTimes.rise;
//			var moonSet;
			if (moment(moonTimes.rise).isBefore(moonTimes.set)) {
				moonRise = moonTimes.rise;
			} else {
				var nextMoonTimes = SunCalc.getMoonTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				moonRise = nextMoonTimes.rise;
			}
			if (moment(moonTimes.set).isAfter(moonTimes.rise)) {
				moonSet = moonTimes.set;
			} else {
				var nextMoonTimes = SunCalc.getMoonTimes(now.clone().add(1, "day"), this.config.lat, this.config.lon);
				moonSet = nextMoonTimes.set;
			}
			var isVisible = now.isBetween(moonRise, moonSet) || moonTimes.alwaysUp === true;
			var illuminatedFractionString = Math.round(moonIllumination.fraction * 100) + "%";
			if (Math.round(moonIllumination.fraction * 100) === 100) {illuminatedFractionString = this.translate("Full Moon");}
			if (Math.round(moonIllumination.fraction * 100) === 0) {illuminatedFractionString = this.translate("New Moon");}
			moonWrapper.innerHTML = "<span class=brightness \"" + (isVisible ? "bright" : "dimmed") + "\"> <i class=\"wi wi-night-clear\"></i>&nbsp; " + illuminatedFractionString + "</span>" +
				"<span>&nbsp;<i class=\"wi wi-moonrise\"></i>&nbsp; " + (moonRise ? formatTime(this.config, moonRise) : this.translate("TOMORROW")) + "</span>" +
				"<span>&nbsp;<i class=\"wi wi-moonset\"></i>&nbsp; " + (moonSet ? formatTime(this.config, moonSet) : this.translate("TOMORROW")) + "</span>";
		}

		/****************************************************************
		 * Create wrappers for ANALOG clock, only if specified in config
		 */

		if (this.config.displayType !== "digital") {
			// If it isn't 'digital', then an 'analog' clock was also requested

			// Calculate the degree offset for each hand of the clock
			if (this.config.timezone) {
				now.tz(this.config.timezone);
			}
			var second = now.seconds() * 6,
				minute = now.minute() * 6 + second / 60,
				hour = ((now.hours() % 12) / 12) * 360 + 90 + minute / 12;

			// Create wrappers
			var clockCircle = document.createElement("div");
			clockCircle.className = "clockCircle";
			clockCircle.style.width = this.config.analogSize;
			clockCircle.style.height = this.config.analogSize;

			if (this.config.analogFace !== "" && this.config.analogFace !== "simple" && this.config.analogFace !== "none") {
				clockCircle.style.background = "url(" + this.data.path + "faces/" + this.config.analogFace + ".svg)";
				clockCircle.style.backgroundSize = "100%";

				// The following line solves issue: https://github.com/MichMich/MagicMirror/issues/611
				// clockCircle.style.border = "1px solid black";
				clockCircle.style.border = "rgba(0, 0, 0, 0.1)"; //Updated fix for Issue 611 where non-black backgrounds are used
			} else if (this.config.analogFace !== "none") {
				clockCircle.style.border = "0";
			}
			var clockFace = document.createElement("div");
			clockFace.className = "clockFace";

			var clockHour = document.createElement("div");
//			clockHour.id = "clockHour";
			clockHour.style.transform = "rotate(" + hour + "deg)";
			clockHour.className = "clockHour";
			var clockMinute = document.createElement("div");
//			clockMinute.id = "clockMinute";
			clockMinute.style.transform = "rotate(" + minute + "deg)";
			clockMinute.className = "clockMinute";

			// Combine analog wrappers
			clockFace.appendChild(clockHour);
			clockFace.appendChild(clockMinute);

			if (this.config.displaySeconds) {
				var clockSecond = document.createElement("div");
//				clockSecond.id = "clockSecond";
				clockSecond.style.transform = "rotate(" + second + "deg)";
				clockSecond.className = "clockSecond";
				clockSecond.style.backgroundColor = this.config.secondsColor;
				clockFace.appendChild(clockSecond);
			}
			clockCircle.appendChild(clockFace);
		}

		/*******************************************
		 * Combine wrappers, check for .displayType
		 */

		if (this.config.displayType === "digital") {
			// Display only a digital clock
			wrapper.appendChild(dateWrapper);
			wrapper.appendChild(timeWrapper);
			wrapper.appendChild(sunWrapper);
			wrapper.appendChild(moonWrapper);
			wrapper.appendChild(weekWrapper);
		} else if (this.config.displayType === "analog") {
			// Display only an analog clock

			if (this.config.showWeek) {
				weekWrapper.style.paddingBottom = "15px";
			} else {
				dateWrapper.style.paddingBottom = "15px";
			}

			if (this.config.analogShowDate === "top") {
				wrapper.appendChild(dateWrapper);
				wrapper.appendChild(weekWrapper);
				wrapper.appendChild(clockCircle);
			} else if (this.config.analogShowDate === "bottom") {
				wrapper.appendChild(clockCircle);
				wrapper.appendChild(dateWrapper);
				wrapper.appendChild(weekWrapper);
			} else {
				wrapper.appendChild(clockCircle);
			}
		} else {
			// Both clocks have been configured, check position
			var placement = this.config.analogPlacement;

			var analogWrapper = document.createElement("div");
			analogWrapper.className = "analog";
			analogWrapper.style.cssFloat = "none";
			analogWrapper.appendChild(clockCircle);

			var digitalWrapper = document.createElement("div");
			digitalWrapper.className = "digital";
			digitalWrapper.style.cssFloat = "none";
			digitalWrapper.appendChild(dateWrapper);
			digitalWrapper.appendChild(timeWrapper);
			digitalWrapper.appendChild(sunWrapper);
			digitalWrapper.appendChild(moonWrapper);
			digitalWrapper.appendChild(weekWrapper);

			var appendClocks = function (condition, pos1, pos2) {
				var padding = [0, 0, 0, 0];
				padding[placement === condition ? pos1 : pos2] = "20px";
				analogWrapper.style.padding = padding.join(" ");
				if (placement === condition) {
					wrapper.appendChild(analogWrapper);
					wrapper.appendChild(digitalWrapper);
				} else {
					wrapper.appendChild(digitalWrapper);
					wrapper.appendChild(analogWrapper);
				}
			};

			if (placement === "left" || placement === "right") {
				digitalWrapper.style.display = "inline-block";
				digitalWrapper.style.verticalAlign = "top";
				analogWrapper.style.display = "inline-block";

				appendClocks("left", 1, 3);
			} else {
				digitalWrapper.style.textAlign = "center";

				appendClocks("top", 2, 0);
			}
		}

		// Return the wrapper to the dom.
		return wrapper;
	}
});