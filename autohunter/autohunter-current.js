const puppeteer = require('puppeteer');
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('file-system');

const currentAuctionData = [];
const auctionURLList = [];

const website = 'https://autohunter.com/Auctions?FilterByStatus=LiveAuctions';

const getData = async (url) => {
  console.log('Starting getData...');
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    // added timeout so it won't give a timeouterror
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    const currentAuction = await page.$$eval('div.vehicle-panel', (panels) =>
      panels.map((panel) => {
        const url = panel.querySelector('a').getAttribute('href');
        const price = panel.querySelector('span.awe-rt-HideOnEnd.current-bid-label.b.d-block.teal.vehicle-description-fontSize > span.NumberPart').textContent;
        const title = panel.querySelector('h2.vehicle-title.vehicle-fontSize.b.black.caps.la-text.no-margin > a').textContent.trim();
        return { url: 'https://autohunter.com/' + url, price, title };
      })
    );

    auctionURLList.push(...currentAuction);
    await browser.close();
  } catch (error) {
    console.error('Error in getData:', error);
  }
  console.log('Completed getData');
};

const GetDataFromPage = async ({ pageUrl, price, title }) => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const data = await page.evaluate((title) => {
    const REGEX = /^[12][0-9]{3}$/; // Define the regex here
    const titleArray = title.split(' ');
    let index = titleArray.findIndex((item) => REGEX.test(item));
    const cleanTitleArray = titleArray.slice(index);
    const year = cleanTitleArray[0];
    const brand = cleanTitleArray[1];
    const description = cleanTitleArray.slice(2).join(' ');

    let imgSrc = document.querySelector('input[src]');
    let img = imgSrc ? imgSrc.getAttribute('src') : '';

    return { year, brand, description, img };
  }, title);

  if (data.year && data.brand && data.description && data.img) {
    currentAuctionData.push({ price: '$' + price, ...data });
  }

  await browser.close();
};

const main = async () => {
  console.log('Script started');
  await getData(website);
  console.log('Data fetched, processing each page...');
  for (const item of auctionURLList) {
    console.log(`Processing: ${item.url}`);
    await GetDataFromPage({ pageUrl: item.url, price: item.price, title: item.title });
  }

  // export to excel file
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(currentAuctionData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'autohunter-current.xlsx');

  // export to json file
  const jsonContent = JSON.stringify(currentAuctionData);
  fs.writeFileSync('autohunter-current.json', jsonContent, 'utf-8');

  console.log('All data processed. Final output:');
  console.log(currentAuctionData);
  console.log('Script finished');
};

main();
