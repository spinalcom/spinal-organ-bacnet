const bacnet = require ('bacstack')
const {
     ObjectTypesSupported,
     PropertyIdentifier,
   } = require ('bacstack/lib/enum.js');

const client = new bacnet ();
//76
//77 name

const requestArray = [{
   objectId: {type: 8, instance: 5},
   properties: [{id: 78}]
 }];


client.readProperty("10.37.67.41", { type: 0, net: 13, adr: [ 5, 0, 0, 0, 0, 0 ] }, {type: 8, instance: 5}, 76,{
   arrayIndex: 79
}, (err, data) => {
   if (err) {
      console.error(err);
      return;
   }
   console.log(data);
})


// client.readPropertyMultiple("10.37.67.41", { type: 0, net: 13, adr: [ 5, 0, 0, 0, 0, 0 ] }, requestArray, {
//    arrayIndex: 1 
// }, (err, data) => {
//    if (err) {
//       console.error(err);
//       return;
//    }
//    console.log(data);
// })