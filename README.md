# ioBroker.etamon
ioBroker adapter for ETA heating systems with XML Rest API (touch display)

> *The development of the adapter has shown issues when running on less performant devices such as NAS devices.*
> *You can still use the adapter if you run iobroker on a common desktop/laptop device.*

As a consequence I recommend using the following JS implementation - you will just need to map once the proper URI from your ETA device.
```
var http = require('http');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;

var etaIP = 'http://192.168.XYZ.XYZ:8080/user/var';

	// 1. URI
	// 2. iobroker Object
	// 3. read
	// 4. write
	// 5. name
	// 6. type
	// 7. unit
	// 8. role
	// 9. CCU variable (optional)
var etaVars = [
	 ["/120/10251/0/0/12242",		"eta.puffer.oben",				true, false, "Puffer oben",						"number",	"°C",		"value.temperature",    "hm-rega.0.1810"]
	,["/120/10251/0/0/12244",		"eta.puffer.unten",				true, false, "Puffer unten",					"number",	"°C",		"value.temperature",    "hm-rega.0.1811"]
	,["/120/10251/0/0/12207",		"eta.puffer.aktion",			true, false, "Puffer Aktion",					"string",	"",			"state",                "hm-rega.0.1809"]
	,["/120/10251/0/0/12533",		"eta.puffer.leistung",			true, false, "Puffer Leistung",					"number",	"KW",		"state",                "hm-rega.0.5038"]
	,["/120/10251/0/0/12129",		"eta.puffer.zustand",			true, false, "Puffer Zustand",					"string",	"",			"state",                ""]
	
	,["/120/10101/0/0/12090",		"eta.hk.1.zustand",				true, false, "Heizkreis Zustand",				"string",	"",			"state",                "hm-rega.0.1812"]
	,["/120/10101/0/0/12241",		"eta.hk.1.vorlauf",				true, false, "Heizkreis Vorlauf",				"number",	"°C",		"value.temperature",    "hm-rega.0.8047"]
	,["/120/10101/0/0/12111",		"eta.hk.1.heizkurve",			true, false, "Heizkreis Heizkurve",				"number",	"°C",		"value.temperature",    "hm-rega.0.8048"]
	,["/120/10101/0/11124/0",		"eta.hk.1.pumpe",				true, false, "Heizkreis Pumpe",					"string",	"",			"state",                "hm-rega.0.1813"]
	,["/120/10101/0/11124/2001",	"eta.hk.1.anforderung",			true, false, "Heizkreis Anforderung",			"string",	"",			"state",                ""]
	
	,["/40/10021/0/0/12000",		"eta.kessel.aktion",			true, false, "Kessel",      					"string",	"",			"state",                "hm-rega.0.1822"]
	,["/40/10021/0/0/12153",		"eta.kessel.vollast",			true, false, "Kessel Vollaststunden",			"string",	"",		    "state",                "hm-rega.0.1814"]
	,["/40/10021/0/0/12016",		"eta.kessel.verbrauch",			true, false, "Kessel Gesmtverbrauch",			"number",	"kg",		"state",                "hm-rega.0.1815"]
	,["/40/10021/0/0/12013",		"eta.kessel.aschebox",			true, false, "Kessel Verbrauch seit Aschebox",	"number",	"kg",		"state",                ""]
	,["/40/10021/0/0/12180",		"eta.kessel.druck",				true, false, "Kessel Druck",					"number",	"bar",		"state",                "hm-rega.0.1820"]
	,["/40/10021/0/0/12001",		"eta.kessel.soll",				true, false, "Kessel Soll",						"number",	"°C",		"state",                "hm-rega.0.5037"]
	,["/40/10021/0/0/12161",		"eta.kessel.ist",				true, false, "Kessel Ist",						"number",	"°C",		"state",                "hm-rega.0.3195"]
	,["/40/10021/0/0/12162",		"eta.kessel.abgasgtemp",		true, false, "Kessel Abgastemperatur",			"number",	"°C",	    "state",                "hm-rega.0.5040"]
	,["/40/10021/0/0/12165",		"eta.kessel.abgasgeblaese",		true, false, "Kessel Abgasgebläse",				"number",	"U/min",	"state",                "hm-rega.0.5039"]
	,["/40/10021/0/0/12164",		"eta.kessel.restsauerstoff",	true, false, "Kessel Restsauerstoff",			"number",	"%",		"state",                "hm-rega.0.5041"]
	,["/40/10021/0/0/12080",		"eta.kessel.zustand",			true, false, "Kessel Zustand",					"string",	"",			"state",                "hm-rega.0.1808"]
	
	,["/40/10201/0/0/12015",		"eta.lager.silo",				true, false, "Pellets Silo",					"number",	"kg",		"state",                "hm-rega.0.1817"]
	,["/40/10021/0/0/12011",		"eta.lager.tag",				true, false, "Pellets Tagesbehälter",			"number",	"kg",		"state",                "hm-rega.0.9651"]
	,["/40/10241/0/0/12197",		"eta.system.aussentemperatur",	true, false, "Aussentemperatur",				"number",	"°C",		"state",                "hm-rega.0.1821"]
];

etaVars.forEach(function(etaVar){
    createState(etaVar[1], 0, {
        read:  etaVar[2],
        write: etaVar[3],
        name:  etaVar[4],
        type:  etaVar[5],
        unit:  etaVar[6],
        role:  etaVar[7]
    });
});

schedule("*/5 * * * *", function () {
    pollETA();
});

pollETA();

function pollETA() {
    // console.log("** Polling ETA Variables");
	etaVars.forEach(function(etaVar){
		http.get(etaIP + etaVar[0], function (http_res) {

			// initialize the container for our data
			var data = "";

			// this event fires many times, each time collecting another piece of the response
			http_res.on("data", function (chunk) {
				// append this chunk to our growing `data` var
				data += chunk;
				// console.log("** ETA chunk: " + chunk);
			});

			// this event fires *one* time, after all the `data` events/chunks have been gathered
			http_res.on("end", function () {
				// console.log("** ETA data: " + data);

				try {
					var doc = new dom().parseFromString(data);
					var select = xpath.useNamespaces({"eta": "http://www.eta.co.at/rest/v1"});

					var strValue    = (select('//eta:value/@strValue',    doc)[0].nodeValue);
					var text        = (select('//eta:value/text()',       doc)[0].nodeValue);
					var scaleFactor = (select('//eta:value/@scaleFactor', doc)[0].nodeValue);
					var unit        = (select('//eta:value/@unit',        doc)[0].nodeValue);
                    var value       = "";
                    
					if (etaVar[5]=="number") {
						value = text * 1.0 / scaleFactor;
					} else {
						value = strValue;
					}

					/* console.log("**** ETA " + etaVar[0] + " @strValue:    " + strValue);
					console.log("**** ETA " + etaVar[0] + " @unit:        " + unit);
					console.log("**** ETA " + etaVar[0] + " text()  :     " + text);
					console.log("**** ETA " + etaVar[0] + " @scaleFactor: " + scaleFactor);
					console.log("** ETA [" + etaVar[4] + "]: " + value + " " + unit); */

					setState(etaVar[1], value);
					
					// Schreibe Variablen zu CCU
					if(etaVar[8]!="") {
					    setState(etaVar[8], value);
					}
				}
				catch (e) {
					log("ETA: Cannot set data "+ etaVar[2] +":" + e, 'error');
				}
			});
		});
	});
	
	var dateFormat = require('dateformat');
	var currentdate = new Date();
	log(dateFormat(currentdate, "dd. mmm yyyy hh:MM"));
	// optional last update in CCU3
	setState("hm-rega.0.7022", dateFormat(currentdate, "dd. mmm yyyy hh:MM"));
}
```
