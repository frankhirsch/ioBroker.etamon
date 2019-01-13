/*jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const request   = require('request-promise');
const utils     = require(__dirname + '/lib/utils');
const adapter   = new utils.Adapter('etamon');
const xpath     = require('xpath');
const xmldom    = require('xmldom').DOMParser;
const select = xpath.useNamespaces({"eta": "http://www.eta.co.at/rest/v1"});
var   menu;
var   variables;
var   addedChannels = 0;
var   addedObjects = 0;
var   addedVariables = 0;
var   skippedVariables = 0;

var   elements = [];
var   channels = [];


adapter.on('ready', function () {
	// Timeout for adapter if ETA takes too long to respond (overall process)
	setTimeout( function() {
		adapter.log.error("ETA service monitoring timeout [" + adapter.config.etaTimeout + "]!");
        adapter.stop();
    }, adapter.config.etaTimeout);
    // Optional delete any "etamon" variable if existing
	adapter.log.debug("** Debug Mode: " + adapter.config.etaDebug);
	if(adapter.config.etaDebug) {
		// After deletion the read will be started
    	deleteEta();
    } else {
    	// Start reading the data from ETA unit
    	readEta();
    }
});

function readEta() {
	// Check if the expectedt global variable (etamon) does exist in the ETA device
	adapter.log.debug("** Retrieve ETA variable etamon");
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon",
			method: "GET"
		},
		function(error, response, content) {
			adapter.log.debug("** Checking if global variable is available");
			if(content.indexOf("<error>") > -1) {
				// When restarting/updating the ETA unit, the stored variable will get lost
				request(
					{
						url: "http://192.168.178.24:8080/user/vars/etamon",
						method: "PUT"
					},
					function(error, response, content) {
						adapter.log.debug("** Created global variable - next: getMenu(true)");
						getMenu(true);
					}
				).catch(
					function() { /* FIX possible ETA status 400 */ }
				)
			} else {
				adapter.log.debug("** Global variable is available - next: getMenu(false)");
				getMenu(false);
			}
		}
	).catch(
		function() { /* FIX possible ETA status 404 */ }
	)

}

function getMenu(createStructure) {
	adapter.log.debug("** do: getMenu("+createStructure+")");
	request(
		{
			url: "http://192.168.178.24:8080/user/menu"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				// Everything is ok - lets parse the XML
				menu = new xmldom().parseFromString(content);
			} else {
				adapter.log.error(error);
			}
		}
	).then(
		function(content) {
			if(createStructure) {
				adapter.log.debug("** Menu variables read - next: setVariables");
				setVariables();
			} else {
				adapter.log.debug("** Menu variables read - next: getVariables");
				getVariables();
				// adapter.stop();
			}
		}
	);
}

function setVariables() {
	var menuNodes = (select('//eta:*[@uri]', menu));
	var addedNodes = 0;
	adapter.log.debug("** ETA menu nodes found: "+menuNodes.length);
	
	for(var i = 0; i<menuNodes.length; i++) {
		adapter.log.silly("** Try to add ETA menu node ["+i+"/"+menuNodes.length+"]: "+menuNodes[i].getAttribute("uri"));
		request(
			{
				url: "http://192.168.178.24:8080/user/vars/etamon" + menuNodes[i].getAttribute("uri"),
				method: "PUT"
			},
			function(error, response, content) {
				// adapter.log.silly("**** Adding ETA variable - error: "+error);
				// adapter.log.silly("**** Adding ETA variable - response: "+response);
				adapter.log.silly("**** Adding ETA variable: "+content);
			}
		).then(
			function() {
				addedNodes++;
				addedVariables++;
				if(addedNodes == menuNodes.length) {
					adapter.log.debug("** "+addedVariables+" ETA variables added, "+skippedVariables+" variables skipped - next: getVariables");
					// adapter.stop();
					getVariables();
					// continue
				}
			}
		).catch(
			function() {
				addedNodes++;
				skippedVariables++;
				if(addedNodes == menuNodes.length) {
					adapter.log.debug("** "+addedVariables+" ETA variables added, "+skippedVariables+" variables skipped - next: getVariables");
					// adapter.stop();
					getVariables();
					// continue
				}
			}
		)
	}
}

function getVariables() {
	//console.log("getVariables 01");
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				// Everything is ok - lets parse the XML
				//console.log("getVariables 02");
				variables = new xmldom().parseFromString(content);
				//console.log("getVariables 03");
			} else {
				//console.log("getVariables 04");
				adapter.log.error(error);
			}
		}
	).then(
		function() {
			//console.log("getVariables 05");
			adapter.log.debug("** Global ETA variables read [then] - next: setObjects");
			setObjects();
		}
	).catch(
		function() {
			//console.log("getVariables 06");
			adapter.log.error("** Global ETA variables not readable");
			adapter.stop();
		}
	)
}

function setObjects() {
	//console.log("setObjects 01");
	
	var menuNodes = (select('//eta:*[@uri]', menu));
	var addedNodes = 0;
	var addedVariables = 0;
	var skippedVariables = 0;
	var thisUri = "";
	adapter.log.debug("** ETA menu nodes found: "+menuNodes.length);
	//console.log("setObjects 02");
	
	
	for(var i = 0; i<menuNodes.length; i++) {
		//console.log("setObjects 03 - "+i);
		//adapter.log.debug("** Try to add ETA menu node ["+i+"/"+menuNodes.length+"]: "+menuNodes[i].getAttribute("uri"));
		var parentNodes = (select('ancestor::eta:*[@uri]', menuNodes[i]));
		var parentPath = "";
		for(var pkey in parentNodes) {
			var parentNode = parentNodes[pkey];
			if (parentNode.getAttribute("uri")!="") {
				if(parentPath!="") {
					parentPath = parentPath + ".";
				}
				parentPath = parentPath + parentNode.getAttribute("uri").substr(1);
			}
		}
		
		if(parentPath!="") {
			thisUri = parentPath.split("/").join("_")+"."+menuNodes[i].getAttribute("uri").substr(1).split("/").join("_");
		} else {
			thisUri = menuNodes[i].getAttribute("uri").substr(1).split("/").join("_");
		}
		//adapter.log.debug("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		var varObjects = (select('//eta:variable[@uri="'+menuNodes[i].getAttribute("uri").substr(1)+'"]',variables));
		//console.log("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		//adapter.stop();
		if(varObjects.length==0) {
			//console.log("setObjects 03.a - "+i);
			channels.push([thisUri, menuNodes[i].getAttribute("name")]);
			adapter.log.silly("** Channel: "+thisUri+" ("+menuNodes[i].getAttribute("name")+") ["+channels.length+"]");
			//setChannel(thisUri, menuNodes[i].getAttribute("name"));
			//console.log("** addedChannels: "+addedChannels);
		} else {
			//console.log("setObjects 03.b - "+i);
			// Read attributes from value node
			var AttUri           = (select('./@uri',           varObjects[0])[0].nodeValue);
			var AttStrValue      = (select('./@strValue',      varObjects[0])[0].nodeValue);
			var AttUnit          = (select('./@unit',          varObjects[0])[0].nodeValue);
			var AttDecPlaces     = (select('./@decPlaces',     varObjects[0])[0].nodeValue);
			var AttScaleFactor   = (select('./@scaleFactor',   varObjects[0])[0].nodeValue);
			var AttAdvTextOffset = (select('./@advTextOffset', varObjects[0])[0].nodeValue);
			var AttText          = (select('./text()',         varObjects[0])[0].nodeValue);
			
			//console.log("object to add: "+thisUri+" => "+menuNodes[i].getAttribute("name"));
			
			// Set params for object
			if(AttUnit.length>0) {
				var outValue = AttText * 1.0 / AttDecPlaces;
				var outType  = "number"
				var outUnit  = AttUnit;
				if(AttUnit=="°C") {
					var outRole  = "value.temperature";
				} else {
					var outRole  = "state";
				}
			} else {
				var outValue = AttStrValue;
				var outType  = "text"
				var outUnit  = AttUnit;
				var outRole  = "state";
			}
			adapter.log.silly("*** outUri  : " + thisUri);
			adapter.log.silly("***   strValue     : " + AttStrValue);
			adapter.log.silly("***   unit         : " + AttUnit);
			adapter.log.silly("***   decPlaces    : " + AttDecPlaces);
			adapter.log.silly("***   scaleFactor  : " + AttScaleFactor);
			adapter.log.silly("***   advTextOffset: " + AttAdvTextOffset);
			adapter.log.silly("***   text()       : " + AttText);
			adapter.log.silly("***     outType  : " + outType);
			adapter.log.silly("***     outValue : " + outValue);
			adapter.log.silly("***     outUnit  : " + outUnit);
			adapter.log.silly("***     outRole  : " + outRole);
			
			// Create object and store data
			//setObject(thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole);
			//setValue (thisUri, outValue);
			elements.push([thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole, outValue]);
			adapter.log.silly("** Element: "+thisUri+" ("+menuNodes[i].getAttribute("name")+") ["+elements.length+"]");
		}
		//console.log("setObjects 04");
		//console.log(varObjects[0]);
	}
	//console.log("setObjects 05");
	adapter.log.debug("** Channels: "+channels.length);
	adapter.log.debug("** Elements: "+elements.length);
	// adapter.stop();
	createChannels();
	
	
	/*
	for(var i = 0; i<channels.length; i++) {
		setChannel(channels[i][0], channels[i][1]);
	}
	for(var i = 0; i<eöements.length; i++) {
		setObject(eöements[i][0], eöements[i][1], eöements[i][2], eöements[i][3], eöements[i][4]);
	}
	*/
	// setChannel(thisUri, menuNodes[i].getAttribute("name")); -> channels
	// setObject(thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole) -> eöements
	// setValue (thisUri, outValue);
	
	/*
	adapter.log.silly("** addedObjects: "+addedObjects+", addedVariables: "+addedVariables);
	
	adapter.log.debug("** ETA Adapter finished");
	*/
	//adapter.stop();
}

function createChannels() {
	console.log("** Channels to create: "+channels.length);
	if(channels.length>0) {	
		createChannel();
	} else {
		adapter.log.debug("** Channels created - next: setObjects");
		createObjects();
		//adapter.stop();
	}
}

function createChannel() {
	console.log("createChannel 01 - " + channels[0][0]);
    adapter.setObjectNotExistsAsync(channels[0][0], {
        type: 'channel',
        common: {
            name: channels[0][1]
        },
        native: {}
    }, function(err) {
    	// Channel created
    });
    
    console.log("createChannel 02 - " + channels[0][0]);
    channels.shift();
    
    createChannels();
}

function createObjects() {
	console.log("** Elements to create: "+elements.length);
	if(elements.length>0) {	
		createObject();
	} else {
		adapter.log.debug("** Elements created - next: createObject");
		//createObjects();
		adapter.stop();
	}
}


function createObject() {
	console.log("createObject 01 - " + elements[0][0]);
	// elements.push([thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole, outValue]);
    adapter.setObjectNotExistsAsync(elements[0][0], {
        type: 'state',
        common: {
            name: elements[0][1],
            type: elements[0][2],
            unit: elements[0][3],
            role: elements[0][4]
        },
        native: {}
    }, function(err) {
    	// Element created
    });
    adapter.setStateAsync(elements[0][0], {
    	val: elements[0][5], 
    	ack: true
    }, function(err) {
    	// Value set
    });
    console.log("createObject 02 - " + elements[0][0]);
    elements.shift();
    
    createObjects();
}

function setValue(uri, value) {
	//console.log("setValue 01 - " + uri);
    adapter.setState(uri, {val: value, ack: true});
	addedObjects++;
	console.log("addedObjects: "+addedObjects);
	//console.log("setValue 02 - " + uri);
}



function deleteEta() {
	adapter.log.debug("** Deleting ETA variabel etamon");
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon",
			method: "DELETE"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				adapter.log.debug("** ETA variable deleted!");
			} else {
				adapter.log.error(error);
			}
		}
	).then(
		function() {
			adapter.log.debug("** Deleted ETA variabel etamon");
			readEta();
		}
	).catch(
		function() {
			adapter.log.debug("** No ETA variabel etamon found to delete");
			readEta();
		}
	);
}
