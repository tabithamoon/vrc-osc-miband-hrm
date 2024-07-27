const osc = require("osc");
const WebSocket = require('ws');
const throttledQueue = require('throttled-queue');
const chatboxRatelimit = throttledQueue(1, 1300);

// Get launch flags
const argv = require('minimist')(process.argv.slice(2));
const launchBrowser = argv.browser ?? true;

// Create placeholder vars
let server = undefined;

// Try to open WebSocket, handle fail
try {
    server = new WebSocket.Server({
        host: argv.host ?? "localhost",
        port: argv.port ?? 3228
    });
}
catch (e) {
    console.error(`Failed to open WebSocket: ${e.message}`);
    process.exit(1);
}

let vrchatOSC = new osc.UDPPort({
    remoteAddress: "localhost",
    remotePort: 9000,
    metadata: true
});

let sendToChatbox = "false";
let chatboxText = "❤{HR} bpm";

vrchatOSC.open();

// Skip launching browser if flag set
if (launchBrowser) {
    try {
        require('open')('https://vard88508.github.io/vrc-osc-miband-hrm/html/');
    }
    catch {
        console.error("Failed to open default browser.");
    }
}

console.log("Waiting for WebSocket connection...");

server.on('connection', ws => {
    console.log("Connected. Waiting for data...");
    ws.on('message', function message(data) {
        let chatbox_text = JSON.parse(data).text;
        let data_string = data.toString();
        if(chatbox_text) {
            chatboxText = chatbox_text;
        } else if(data_string === "true" || data_string === "false") {
            sendToChatbox = data_string;
        } else {
            if (data == 0) {
                console.log("Got heart rate: 0 bpm, skipping parameter update...");
            } else {
                console.log('Got heart rate: %s bpm', data);
                let heartrate = {
                    address: "/avatar/parameters/Heartrate",
                    args:
                        {
                            type: "f",
                            value: data/127-1
                        }
                };
                let heartrate2 = {
                    address: "/avatar/parameters/Heartrate2",
                    args:
                        {
                            type: "f",
                            value: data/255
                        }
                };
                let heartrate3 = {
                    address: "/avatar/parameters/Heartrate3",
                    args:
                        {
                            type: "i",
                            value: data
                        }
                };
                vrchatOSC.send(heartrate);
                vrchatOSC.send(heartrate2);
                vrchatOSC.send(heartrate3);

                if(sendToChatbox === "true") {

                    chatboxRatelimit(() => {
                        let text = chatboxText.replace("{HR}", data_string)+"    "
                        // console.log('send '+ text);

                        let heartrate_chatbox = {
                            address: "/chatbox/input",
                            args: [
                                { type: "s", value: text},
                                { type: "T", value: true}
                            ],
                        };

                        vrchatOSC.send(heartrate_chatbox);
                    });
                }
            }
        }
    });
});
