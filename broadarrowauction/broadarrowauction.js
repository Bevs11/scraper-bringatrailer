const cheerio = require('cheerio');
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('file-system');

const website = 'https://www.broadarrowauctions.com/vehicles/results?page=';

const auctionData = [];

const getData = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const auction = $('div.ft-vehicle-item.grid-block');
    auction.each(function () {
      const title = $(this).find('a.vehicle-card').attr('title');
      const price = $(this).find('a.vehicle-card > div.bottom > div.price > div.bot > span').text().slice(13);
      const imgURL = $(this).find('div.auto.is-vlp.vehicle-ft-image-bg').attr('style');
      const img = imgURL.substring(22, imgURL.length - 1);
      const desc = title.split(' ');
      const year = desc[0];
      const brand = desc[1];
      const description = desc.filter((item, index) => index > 1).join(' ');
      
      if (price.split(' ').length === 1 && !price.includes('Auction') && price !== '') {
        if (
          price !== null &&
          price !== undefined &&
          year !== null &&
          year !== undefined &&
          brand !== null &&
          brand !== undefined &&
          description !== null &&
          description !== undefined &&
          img !== null &&
          img !== undefined
        ) {
          auctionData.push({ price: '$' + price, year, brand, description, img });
        }
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const promises = [];
for (let i = 1; i <= 8; i++) {
  promises.push(getData(website + i));
}

Promise.all(promises).then(() => {
  console.log(auctionData);

  // NOTE: To export as an Excel File
  // const wb = XLSX.utils.book_new();
  // const workSheet = XLSX.utils.json_to_sheet(auctionData);
  // XLSX.utils.book_append_sheet(wb, workSheet, 'Sheet1');
  // XLSX.writeFile(wb, 'broadarrowauction.xlsx');

  // NOTE: To export as a JSON File
  const jsonContent = JSON.stringify(auctionData);
  fs.writeFile('./output/broadarrowauction-data.json', jsonContent, 'utf-8', (err) => {});
});
