const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('file-system');

const currentAuctionData = [];
const auctionURLList = [];

const website = 'https://barnfinds.com/auctions/';

const getData = async (url) => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url);

    const currentAuction = await page.$$eval('#content > div > div > div:nth-child(2) > div > div > p.clearfix', (elements) =>
      elements
        .map((element) => {
          const titleElement = element.querySelector('span.wpa-widget-title > a');
          const priceElement = element.querySelector('span.wpa-widget-price');
          if (!titleElement || !priceElement) {
            return null;
          }
          const title = titleElement.textContent.trim();
          const price = priceElement.textContent.trim();
          const shortTitle = title.toLowerCase().split(' ').join('-');
          const urlText = `https://barnfinds.com/bf-auction-${shortTitle}/`;

          console.log({ title, price, shortTitle, url: urlText });

          return { url: urlText, price };
        })
        .filter((item) => item)
    );

    auctionURLList.push(...currentAuction);
    await browser.close();
  } catch (error) {
    console.error('Error in getData:', error);
  }
};

const GetDataFromPage = async (browser, { url, price }) => {
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1.entry-title')?.textContent.trim() || '';
      const titleArray = title.split(' ');
      const year = titleArray[2];
      const brand = titleArray[3];
      const description = titleArray.slice(4).join(' ');
      const img = document.querySelector('p.image > a > img')?.src || '';

      return { year, brand, description, img };
    });

    if (data.year && data.brand && data.description && (data.img || price)) {
      currentAuctionData.push({ price, ...data });
    }

    await page.close();
  } catch (error) {
    console.error(`Error in GetDataFromPage for ${url}:`, error);
  }
};

const main = async () => {
  console.log('Script started');

  const browser = await puppeteer.launch({ headless: 'new' });
  await getData(website);

  for (const item of auctionURLList) {
    await GetDataFromPage(browser, item);
  }

  await browser.close();

  // Export data to Excel
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(currentAuctionData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'barnfinds-current.xlsx');

  // Export data to JSON
  const jsonContent = JSON.stringify(currentAuctionData);
  fs.writeFileSync('barnfinds-current-data.json', jsonContent, 'utf-8');

  console.log(currentAuctionData);
  console.log('Script finished');
};

main();
