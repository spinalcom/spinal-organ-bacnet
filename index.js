// require('./dist/index')


const { BacnetUtilities } = require("./dist/utilities/BacnetUtilities");
BacnetUtilities.initAndConnect()



// export function decodeBitStringValue(value, bitText) {
//     const result = [];
//     const { value: valueArray, bitsUsed } = value;

//     for (let i = 0; i < bitsUsed; i++) {
//         const byteIndex = Math.floor(i / 8);
//         const bitIndex = i % 8;

//         const isActive = (valueArray[byteIndex] & (1 << bitIndex)) !== 0;

//         result.push({ id: i, value: isActive, name: bitText ? bitText[i] : `Bit ${i}` });
//     }

//     return result;
// }

// console.log(decodeBitStringValue({ value: [0, 0, 0], bitsUsed: 20 }, ["Bit 0", "Bit 1", "Bit 2", "Bit 3"]));