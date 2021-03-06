/* Magic Mirror
 * Node Helper: Calendar
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
const NodeHelper = require("node_helper");
const validUrl = require("valid-url");
const CalendarFetcher = require("./calendarfetcher.js");
const Log = require("../../../js/logger");

module.exports = NodeHelper.create({
	// Override start method.
	start() {
		Log.log("Starting node helper for: " + this.name);
		this.fetchers = [];
	},

	// Override socketNotificationReceived method.
	socketNotificationReceived(notification, payload) {
		if (notification === "ADD_CALENDAR") {
			this.createFetcher(payload.url, payload.fetchInterval, payload.excludedEvents, payload.maximumEntries, payload.maximumNumberOfDays, payload.auth, payload.broadcastPastEvents, payload.selfSignedCert, payload.id);
		}
	},

	/**
	 * Creates a fetcher for a new url if it doesn't exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * @param {string} url The url of the calendar
	 * @param {number} fetchInterval How often does the calendar needs to be fetched in ms
	 * @param {string[]} excludedEvents An array of words / phrases from event titles that will be excluded from being shown.
	 * @param {number} maximumEntries The maximum number of events fetched.
	 * @param {number} maximumNumberOfDays The maximum number of days an event should be in the future.
	 * @param {object} auth The object containing options for authentication against the calendar.
	 * @param {boolean} broadcastPastEvents If true events from the past maximumNumberOfDays will be included in event broadcasts
	 * @param {boolean} selfSignedCert If true, the server certificate is not verified against the list of supplied CAs.
	 * @param {string} identifier ID of the module
	 */
	createFetcher: function (url, fetchInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, broadcastPastEvents, selfSignedCert, identifier) {
		var self = this;

		if (!validUrl.isUri(url)) {
			this.sendSocketNotification("INCORRECT_URL", { id: identifier, url: url });
			return;
		}

		var fetcher;

		if (typeof this.fetchers[identifier + url] === "undefined") {
			Log.log("Create new calendar fetcher for url: " + url + " - Interval: " + fetchInterval);
			fetcher = new CalendarFetcher(url, fetchInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, broadcastPastEvents, selfSignedCert);

			fetcher.onReceive(function(fetcher) {
				self.broadcastEvents(fetcher, identifier);
			});

			fetcher.onError(function(fetcher, error) {
				Log.error("Calendar Error. Could not fetch calendar: ", fetcher.url(), error);
				self.sendSocketNotification("FETCH_ERROR", {
					id: identifier,
					url: fetcher.url(),
					error: error
				});
			});

			this.fetchers[identifier + url] = fetcher;
		} else {
			Log.log("Use existing calendar fetcher for url: " + url);
			fetcher = this.fetchers[identifier + url];
//			fetcher.setReloadInterval(fetchInterval);
			fetcher.broadcastEvents();
		}

		fetcher.startFetch();
	},

	/**
	 *
	 */
	broadcastEvents(fetcher, identifier) {
		this.sendSocketNotification("CALENDAR_EVENTS", {
			id: identifier,
			url: fetcher.url(),
			events: fetcher.events()
		});
	}
});