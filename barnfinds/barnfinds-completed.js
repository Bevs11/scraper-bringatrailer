const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('file-system');

const completedAuctionData = [];
const auctionURLList = [];

const website = 'https://barnfinds.com/auctions/';

const getData = async (url) => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    // added timeout so it won't give a timeouterror
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    const completedAuction = await page.$$eval('div.wpa-other-item', (elements) =>
      elements
        .map((element) => {
          const titleElement = element.querySelector('span.wpa-widget-title');
          if (!titleElement) return null;

          const title = titleElement.textContent.trim();
          const shortTitle = title.toLowerCase().split(' ').join('-');
          const urlText = `https://barnfinds.com/bf-auction-${shortTitle}`;
          return title ? urlText : null;
        })
        .filter((item) => item !== null)
    );

    auctionURLList.push(...completedAuction);
    await browser.close();
  } catch (error) {
    console.error('Error in getData:', error);
  }
};

const GetDataFromPage = async (browser, pageUrl) => {
  try {
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1.entry-title')?.textContent.trim() || '';
      const titleArray = title.split(' ');
      const year = titleArray[2];
      const brand = titleArray[3];
      const description = titleArray.slice(4).join(' ');
      const img = document.querySelector('p.image > a > img')?.src || '';
      const priceElement = document.querySelector('div.entry-content > div:nth-child(1) > span:nth-child(1)');
      const price = priceElement?.textContent.trim() || '';
      const priceAmount = price.split(' ');
      const priceValue = priceAmount[priceAmount.length - 1];

      return { title, year, brand, description, img, price: priceValue };
    });

    if (
      data.price !== null &&
      data.price !== undefined &&
      data.price !== '' &&
      data.year !== null &&
      data.year !== undefined &&
      data.brand !== null &&
      data.brand !== undefined &&
      data.description !== null &&
      data.description !== undefined &&
      data.img !== null &&
      data.img !== undefined
    ) {
      completedAuctionData.push(data);
    }

    await page.close();
  } catch (error) {
    console.error(`Error in GetDataFromPage for ${pageUrl}:`, error);
  }
};

const main = async () => {
  console.log('Script started');

  const browser = await puppeteer.launch({ headless: 'new' });
  await getData(website);

  for (const url of auctionURLList) {
    console.log(`Processing URL: ${url}`);
    await GetDataFromPage(browser, url);
  }

  await browser.close();

  // Export data to Excel
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(completedAuctionData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'barnfinds-completed.xlsx');

  // Export data to JSON
  const jsonContent = JSON.stringify(completedAuctionData);
  fs.writeFileSync('barnfinds-completed-data.json', jsonContent, 'utf-8');

  console.log(completedAuctionData);
  console.log('Script finished');
};

main();
