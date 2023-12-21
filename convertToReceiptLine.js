const readline = require('readline');
const fs = require('fs');
const axios = require('axios'); 
const imageBase64 = require('./imageData');
const os = require('os');

// Constants for field indexes for clearer reference
const RECEIPT_NO = 0;
const CASHIER = 1;
const ITEM_CODE = 2;
const ITEM_NAME = 3;
const UNIT_PRICE = 4;
const QTY = 5;
const TOTAL = 6;
const DISCOUNT_UNIT = 7;
const TOTAL_WITH_DISCOUNT = 8;
const SUM_USD = 9;
const SUM_KHR = 10;
const DISCOUNT_CART = 11;
const GRAN_TOTAL_USD = 12;
const GRAN_TOTAL_KHR = 13;
const PAY_BY = 14;
const DELIVERY_SERVICE_NAME = 15;
const USD_RECEIVED = 16;
const KHR_RECEIVED = 17;
const CHANGE_USD = 18;
const CHANGE_KHR = 19;

// Get the receipt number from the command-line argument
const receiptNumber = process.argv[2];  // argv[0] is 'node', argv[1] is the script filename
console.log("Receipt Number:", receiptNumber);

// Get the temprary path
const tempDir = os.tmpdir();

// Function to create a readline interface for the first existing file
function createReadInterface(tempDir, baseDir, receiptNumber) {
  let dirIndex = 0;
  let filePath;

  // Loop to construct the file path and check if it exists
  do {
    const dirSuffix = dirIndex === 0 ? '' : `.${dirIndex}`;
    filePath = `${tempDir}/${baseDir}${dirSuffix}/${receiptNumber}.txt`;
    dirIndex++;
  } while (!fs.existsSync(filePath) && dirIndex < 10); // Up to 10 tries

  // Return null if no file is found after trying S11 to S11.9
  if (!fs.existsSync(filePath)) {
    console.log("File not found in any of the directories.");
    return null;
  }

  // Create and return the readline interface for the found file
  return readline.createInterface({
    input: fs.createReadStream(filePath),
    output: process.stdout,
    terminal: false
  });
}

const baseDir = 'S11'; // The base directory name without the suffix
const readInterface = createReadInterface(tempDir, baseDir, receiptNumber);

if (readInterface) {
  readInterface.on('line', function(line) {
    console.log(line);
  });
}

// Set up a readline interface to read the input file line-by-line
// Temporary path S11
// const readInterface = readline.createInterface({
//   input: fs.createReadStream(`${tempDir}/S11/${receiptNumber}.txt`), 
//   output: process.stdout,
//   terminal: false
// });

// Fixed path
// const readInterface = readline.createInterface({
//   input: fs.createReadStream(`../ExportedReceipts/${receiptNumber}.txt`), 
//   output: process.stdout,
//   terminal: false
// });

let items = [];
let headerInfo = null;
let image = imageBase64; 

// To format numbers with currency symbols: Current up to the 2nd decimal place for the both USD & KHR
const formatNumber = (value, symbol = '') => {
  const numericValue = parseFloat(value); // Converts the string to a number, removing any leading zeros

  // For USD or default formatting, up to the 2nd decimal place
  if (symbol === ' USD' || symbol === '    '|| symbol === '') {
    return numericValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + symbol;
  } else {
    // For KHR or other currencies, no decimals
    return numericValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + symbol;
    // return symbol + parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  }
};

// Process each line of the input file
readInterface.on('line', function(line) {
  const fields = line.split('\t');

  if (!headerInfo) {
    headerInfo = {
      receipt_no: fields[RECEIPT_NO],
      cashier: fields[CASHIER],
      sum_USD: formatNumber(fields[SUM_USD],' USD'),
      sum_KHR: formatNumber(fields[SUM_KHR], ' KHR'),
      discount_cart: fields[DISCOUNT_CART] + '%',
      GranTotal_USD: formatNumber(fields[GRAN_TOTAL_USD], ' USD'),
      GranTotal_KHR: formatNumber(fields[GRAN_TOTAL_KHR], ' KHR'),
      Pay_by: fields[PAY_BY],
      DeliveryServiceName: fields[DELIVERY_SERVICE_NAME],
      Usd: formatNumber(fields[USD_RECEIVED], ' USD'),
      Khr: formatNumber(fields[KHR_RECEIVED], ' KHR'),
      change_usd: formatNumber(fields[CHANGE_USD], ' USD'),
      change_khr: formatNumber(fields[CHANGE_KHR], ' KHR'),
  };
  
  }
  
// Only push to items if there's a value for 7: discount_unit
if (fields[DISCOUNT_UNIT] && parseFloat(fields[DISCOUNT_UNIT]) !== 0){
  items.push(
    `"${fields[ITEM_CODE]}" "${fields[ITEM_NAME]}" |
    ||| "${formatNumber(fields[UNIT_PRICE], '')}" x "${fields[QTY]}" | "${fields[DISCOUNT_UNIT]}"| "${formatNumber(fields[TOTAL_WITH_DISCOUNT], '    ')}"
`);
} else {
  items.push(
    `"${fields[ITEM_CODE]}" "${fields[ITEM_NAME]}" |
    ||"${formatNumber(fields[UNIT_PRICE], '')}" x "${fields[QTY]}"| "${formatNumber(fields[TOTAL], '    ')}"
`);
}
});
// ORIGINAL Currency symbol before amount
//   if (fields[DISCOUNT_UNIT]) {
//     items.push(
//       `"${fields[ITEM_NAME]}" |
//   "${fields[ITEM_CODE]}"    | | "${formatNumber(fields[UNIT_PRICE], '$')}" x "${fields[QTY]}"| "${formatNumber(fields[TOTAL], '$')}"
//                     | "${fields[DISCOUNT_UNIT]}"   
//                     | "${formatNumber(fields[TOTAL_WITH_DISCOUNT], '$')}"
//   `);
// } else {
//     items.push(
//       `"${fields[ITEM_NAME]}" |
//   "${fields[ITEM_CODE]}"    | | "${formatNumber(fields[UNIT_PRICE], '$')}" x "${fields[QTY]}"| "${formatNumber(fields[TOTAL], '$')}"
//   `);
// }

// Function to format date and time
function formatDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function generateReceipt(headerInfo, items) {
  // Check if there's a valid value for discount_cart
  const discountValueRaw = headerInfo.discount_cart.replace('%', '').trim();
  const discountValue = parseFloat(discountValueRaw);
  const hasDiscount = !isNaN(discountValue) && discountValue !== 0;
  const dateTime = formatDateTime();

  let discountSection = '';
  if (hasDiscount) {
      discountSection = 
      `Sub Total USD | "${headerInfo.sum_USD}"
      Cart Discount                           "${headerInfo.discount_cart}" |`;
  } else {
    discountSection = '';
}

  // Check if there's a value for Usd or Khr
  const receivedCashUsd = headerInfo.Usd && parseFloat(headerInfo.Usd.replace('USD', '').trim()) !== 0;
  const receivedCashKhr = headerInfo.Khr && parseFloat(headerInfo.Khr.replace('KHR', '').trim()) !== 0;
  let changeSection = '';

  if (receivedCashUsd || receivedCashKhr) {
    changeSection = 
    `Received  USD | "${headerInfo.Usd}"
    | KHR | "${headerInfo.Khr}"|
    Change    USD   | "${headerInfo.change_usd}"
    | KHR | "${headerInfo.change_khr}"|`;
  }


  return `
${image}

Riceball PNH
ST.360 AND ST.57, BKK
069-823-736

Receipt No.    | "${headerInfo.receipt_no}"
|${dateTime}       | POS No. 001
Cashier        | "${headerInfo.cashier}"

${items.join('')}
-----------------------------------------------
${discountSection}${hasDiscount ? '\n' : ''}
Total     USD       | "${headerInfo.GranTotal_USD}"
| KHR | "${headerInfo.GranTotal_KHR}"|
-----------------------------------------------
Paid by |"${headerInfo.Pay_by}" ||| "${headerInfo.DeliveryServiceName}"
${changeSection}

Thank you for your visit!
`;
}

// Function to send the receipt data to the ReceiptLine server
function sendReceiptToPrintServer(data) {
  const url = 'http://127.0.0.1:8080/tm_t20iii';
  return axios.post(url, data)
      .then(response => {
          console.log('Receipt sent to printer successfully:', response.data);
      })
      .catch(error => {
          console.error('Failed to send receipt to printer:', error);
      });
}

// Generate receipt and send to print server
readInterface.on('close', function() {
  const receiptData = generateReceipt(headerInfo, items);

  // Send to print server
  sendReceiptToPrintServer(receiptData);

  // Save to output.txt file
  fs.writeFile('output.txt', receiptData, (err) => {
    if (err) {
      console.error('Failed to save receipt to file:', err);
    } else {
      console.log('Receipt saved to output.tab');
    }
  });
});


