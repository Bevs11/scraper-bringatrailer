const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('file-system');

const completedAuctionData = [];
const auctionURLList = [];

const website = 'https://autohunter.com/Auctions?FilterByStatus=CompletedAuctions';

const getData = async (browser, url) => {
  try {
    const page = await browser.newPage();
    await page.goto(url);

    const completedAuction = await page.$$eval('div.vehicle-panel', (panels) =>
      panels.map((panel) => {
        const url = panel.querySelector('a').getAttribute('href');
        const price = panel.querySelector('span.awe-rt-HideOnEnd.current-bid-label.b.d-block.teal.vehicle-description-fontSize > span.NumberPart').textContent;
        const title = panel.querySelector('h2.vehicle-title.vehicle-fontSize.b.black.caps.la-text.no-margin > a').textContent.trim();
        return { url: 'https://autohunter.com/' + url, price, title };
      })
    );

    auctionURLList.push(...completedAuction);
    await page.close();
  } catch (error) {
    console.error('Error in getData:', error);
  }
};

const GetDataFromPage = async (browser, { pageUrl, price, title }) => {
  try {
    const page = await browser.newPage();
    await page.goto(pageUrl);

    const data = await page.evaluate((title) => {
      const REGEX = /^[12][0-9]{3}$/;
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
      completedAuctionData.push({ price: '$' + price, ...data });
    }

    await page.close();
  } catch (error) {
    console.error(`Error in GetDataFromPage for ${pageUrl}:`, error);
  }
};

const main = async () => {
  console.log('Script started');
  const browser = await puppeteer.launch({ headless: 'new' });
  await getData(browser, website);

  for (const item of auctionURLList) {
    console.log(`Processing: ${item.url}`);
    await GetDataFromPage(browser, { pageUrl: item.url, price: item.price, title: item.title });
  }

  await browser.close();

  // export to excel file
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(completedAuctionData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, 'autohunter-completed.xlsx');

  // export to json file
  const jsonContent = JSON.stringify(completedAuctionData);
  require('fs').writeFileSync('autohunter-completed-data.json', jsonContent, 'utf-8');

  console.log('All data processed. Final output:');
  console.log(completedAuctionData);
  console.log('Script finished');
};

main();
