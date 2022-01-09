import * as sdk from "matrix-js-sdk";
import log from "loglevel";
import crypto from "crypto";

'use strict';

// run as for i in `seq 0 7`; do node index.js $i &; done

// const quantum = 5000;
// const pause = 1000;
const quantum = 0;
const pause = 0;
const async = true;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const id = parseInt(process.argv[2]);

export const logger = log.getLogger("matrix");
logger.setLevel(log.levels.DEBUG, false);
var originalFactory = logger.methodFactory;
logger.methodFactory = (methodName, logLevel, loggerName)=>{
    var rawMethod = originalFactory(methodName, logLevel, loggerName);

    return (message, ...args)=>{
        rawMethod.call(logger, `${id} [${new Date().toISOString()}] ${message}`, ...args);
    };
};
logger.setLevel(log.levels.DEBUG, false);

const identities = [
    { userId: "@test1:shadowfax",  deviceId: "RKYNJFTVIN", accessToken: "secret" },
    { userId: "@test2:shadowfax",  deviceId: "RXYDJTYJCC", accessToken: "secret" },
    { userId: "@test3:shadowfax",  deviceId: "STDBSRJQHS", accessToken: "secret" },
    { userId: "@test4:shadowfax",  deviceId: "UJNBVELKMU", accessToken: "secret" },
    { userId: "@test5:shadowfax",  deviceId: "JQJAPHNJCF", accessToken: "secret" },
    { userId: "@test6:shadowfax",  deviceId: "BLYEIRYQLF", accessToken: "secret" },
    { userId: "@test7:shadowfax",  deviceId: "FVQMROYVZU", accessToken: "secret" },
    { userId: "@test8:shadowfax",  deviceId: "VIJPAABBEF", accessToken: "secret" },
//     // { userId: "@test9:shadowfax",  deviceId: "TTJINTODUG", accessToken: "secret" },
//     // { userId: "@test10:shadowfax", deviceId: "FWLEHHKMEY", accessToken: "secret" },
//     // { userId: "@test11:shadowfax", deviceId: "TUCDHFNGOF", accessToken: "secret" },
//     // { userId: "@test12:shadowfax", deviceId: "IIXFSLNVPE", accessToken: "secret" },
//     // { userId: "@test13:shadowfax", deviceId: "TEMBLHZWPF", accessToken: "secret" },
//     // { userId: "@test14:shadowfax", deviceId: "OKTMKDNCVI", accessToken: "secret" },
//     // { userId: "@test15:shadowfax", deviceId: "KIQECWOQLU", accessToken: "secret" },
//     // { userId: "@test16:shadowfax", deviceId: "LCOZSFPLPA", accessToken: "secret" },
//     // { userId: "@test17:shadowfax", deviceId: "OOQVVTPMTP", accessToken: "secret" },
//     // { userId: "@test18:shadowfax", deviceId: "YMMLYYXGEZ", accessToken: "secret" },
//     // { userId: "@test19:shadowfax", deviceId: "IESBTSNTIS", accessToken: "secret" },
//     // { userId: "@test20:shadowfax", deviceId: "QEUKLMRNQF", accessToken: "secret" },
];

const client = sdk.createClient({
    // baseUrl: "https://robertlong.dev",
    baseUrl: "http://localhost:8008",
    userId: identities[id].userId,
    accessToken: identities[id].accessToken,
});

const count = 10;

let echoes = {};
for (const identity of identities) {
    echoes[identity.userId] = [];
}

let draining = false;
client.on("toDeviceEvent", (ev)=>{
    const event = ev.event;
    if (event.type != 'org.matrix.test') return;
    logger.log("<", event.sender, event.content.cycle, event.content.index);
    echoes[event.sender][event.content.cycle] ||= Array(count).fill(0);
    echoes[event.sender][event.content.cycle][event.content.index] = 1;
    draining = true;
});

let spamming = true;
process.on('SIGINT', async function() {
    spamming = false;
    do {
        draining = false;
        await delay(10000);
    } while (draining);

    logger.log(JSON.stringify(echoes).replaceAll("],[","],\n[").replaceAll("]],","]\n],\n").replaceAll("[[","\n[\n["));
    process.exit();
});

await client.startClient({initialSyncLimit: 0});

const data = crypto.randomBytes(2000).toString('hex');

function sendDevice(identity, cycle, index, data) {
    const contentMap = {};
    contentMap[identity.userId] = {};
    contentMap[identity.userId][identity.deviceId] = { cycle, index, data };
    logger.log(">", identity.userId, cycle, index);
    return client.sendToDevice("org.matrix.test", contentMap);
}

let cycle = 0;
while(spamming) {
    // synchronise our loop so it starts on a 5 second boundary
    const now = new Date().getTime();
    const target = new Date((parseInt(now / quantum) + 1) * quantum);
    await delay((target - now));
    for (let index = 0; index < count; index++) {
        const promises = [];
        const promiseIdentities = [];
        const otherPromises = [];
        for (let i = 0; i < identities.length; i++) {
            if (i == id) continue;
            const identity = identities[i];
            if (Math.random() < 0.4) {
                const presence = Math.random() < 0.5 ? "offline" : "online";
                logger.log("> presence", presence);
                if (async) {
                    otherPromises.push(client.setPresence(presence));
                }
                else {
                    logger.log(JSON.stringify(await client.setPresence(presence)));
                }
            }
            // if (Math.random() < 0.2) {
            //     logger.log("> state");
            //     if (async) {
            //         otherPromises.push(client.sendStateEvent("!HsjEbZOPWHrbNTogsz:robertlong.dev", "org.matrix.test.member", {"data": "test"}));
            //     }
            //     else {
            //         logger.log(JSON.stringify(client.sendStateEvent("!HsjEbZOPWHrbNTogsz:robertlong.dev", "org.matrix.test.member", {"data": "test"})));
            //     }
            // }
            const p = sendDevice(identity, cycle, index, data);
            if (async) {
                promises.push(p);
                promiseIdentities.push(identity);
            }
            else {
                logger.log(JSON.stringify(await p));
            }
        }
        if (async) {
            await Promise.allSettled(promises).then(async values => {
                for (let i = 0; i < values.length; i++) {
                    if (values[i].status == "rejected") {
                        logger.log("retried",
                                    promiseIdentities[i].userId,
                                    cycle, index,
                                    JSON.stringify(
                                        await sendDevice(promiseIdentities[i], cycle, index, data)
                                    ));
                    }
                }
                logger.log("to-device", JSON.stringify(values, null, 2));
            });
            await Promise.allSettled(otherPromises).then(values => {
                logger.log("others", JSON.stringify(values, null, 2));
            });
        }
        if (index >= 3) await delay(pause);
    }
    cycle++;
}