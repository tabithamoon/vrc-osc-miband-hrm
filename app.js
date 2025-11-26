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
    remoteAddress: argv["osc-host"] ?? "localhost",
    remotePort: argv["osc-port"] ?? 9000,
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

    let isHRConnected = { address: "/avatar/parameters/isHRConnected", args: { type: "b". value: true } };
    vrchatOSC.send(isHRConnected);
    
    ws.on('message', function message(data) {
        let chatbox_text = JSON.parse(data).text;
        let data_string = data.toString();
        if(chatbox_text) {
            chatboxText = chatbox_text;
        } else if(data_string === "true" || data_string === "false") {
            sendToChatbox = data_string;
        } else {
            if (data == 0) {
                let isHRBeat = { address: "/avatar/parameters/isHRActive", args: { type: "b", value: false } };
                let isHRBeat = { address: "/avatar/parameters/isHRBeat", args: { type: "b", value: false } };
                vrchatOSC.send(isHRActive);
                vrchatOSC.send(isHRBeat);
                
                console.log("Got heart rate: 0 bpm, skipping parameter update...");
            } else {
                console.log('Got heart rate: %s bpm', data);

                let isHRBeat = { address: "/avatar/parameters/isHRActive", args: { type: "b", value: true } };
                let isHRBeat = { address: "/avatar/parameters/isHRBeat", args: { type: "b", value: true } };
                
                let HR = {
                    address: "/avatar/parameters/HR",
                    args: {
                        type: "i",
                        value: data
                    }
                };

                let HRPercent = {
                    address: "/avatar/parameters/HRPercent",
                    args: {
                        type: "f".
                        value: data / (argv["max-hr"] ?? 255)
                    }
                };

                let FullHRPercent = {
                    address: "/avatar/parameters/FullHRPercent",
                    args: {
                        type: "f".
                        value: data / ((argv["max-hr"] ?? 255) / 2) - 1
                    }
                };
                
                vrchatOSC.send(HR);
                vrchatOSC.send(isHRBeat);
                vrchatOSC.send(HRPercent);
                vrchatOSC.send(isHRActive);
                vrchatOSC.send(FullHRPercent);
            }
        }
    });
});
