require('./dist/index')


// const bacnet = require('bacstack');

// // const bacnet = require('node-bacstack');
// // const client = new bacnet({ interface: "192.168.1.66" });
// const client = new bacnet();


// setInterval(() => {
//     client.readProperty('192.168.1.46', null, { type: 2, instance: 14 }, 85, (err, data) => {
//         if (err) {
//             console.log('error COV: ', err);
//             return;
//         }

//         console.log('readProperty');

//     });
// }, 5000);

// client.subscribeCOV('192.168.1.46', { type: 2, instance: 14 }, 1, false, false, 0, (err, data) => {
//     if (err) {
//         console.log('error COV: ', err);
//         return;
//     }
// });

// // client.subscribeProperty('192.168.1.144', {type: 0, instance: 9015},{id:85, index:4294967295}, 1, false, false, (err) => {
// //     console.log('error COV: ', err);
// // });


// client.on('covNotifyUnconfirmed', (data) => {
//     console.log('Received COV');
//     // console.log(data);

//     // console.log(client._events["covNotifyUnconfirmed"].length)
// });