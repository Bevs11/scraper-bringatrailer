const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');
const mongoose = require('mongoose');
const cron = require('node-cron');

// mongodb
const mongoUri = 'mongodb+srv://absalipande:123@cluster0.ybrv9je.mongodb.net/';
// const mongoUri = 'mongodb+srv://hammershift1:knhyxrCw0GwEmGQc@cluster0.kpemmst.mongodb.net/hammershift';

// connect to mongodb
try {
  mongoose.connect(mongoUri);
  console.log('MongoDB connected');
} catch (error) {
  console.error('MongoDB connection error:', err);
}

// define model and schema
const auctionSchema = new mongoose.Schema(
  {
    price: String,
    year: String,
    make: String,
    model: String,
    img: String,
    chassis: String,
    seller: String,
    location: String,
    lot_num: String,
    listing_type: String,
    auction_id: { type: String, unique: true },
    website: String,
    description: [String],
    images_list: [Object],
    listing_details: [String],
  },
  { timestamps: true }
);

const Auction = mongoose.model('Auction', auctionSchema);

const currentAuctionData = [];
const auctionURLList = [];

const website = 'https://bringatrailer.com/auctions/results/';
const batchSize = 20;

// const scrapeInfiniteScrollItems = async (page) => {
//   while (true) {
//     const previousHeight = await page.evaluate('document.body.scrollHeight');
//     await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
//     await page.waitForTimeout(1000);
//     const newHeight = await page.evaluate('document.body.scrollHeight');

//     // break and exit the loop if the page height did not change
//     if (newHeight === previousHeight) {
//       break;
//     }
//   }
// };

const scrapeInfiniteScrollItems = async (page) => {
  let lastItemCount = 0;
  while (true) {
    try {
      // click the show more
      await page.waitForSelector('button.auctions-footer-button', { timeout: 60000 }); // Adjust the timeout as necessary
      await page.click('button.auctions-footer-button');
      console.log('Clicked "Show More" button');

      // Wait for new items to load
      await page.waitForFunction((lastItemCount) => document.querySelectorAll('a.listing-card.bg-white-transparent').length > lastItemCount, {}, lastItemCount);

      // Update item count
      lastItemCount = await page.$$eval('a.listing-card.bg-white-transparent', (items) => items.length);
      console.log(`New item count: ${lastItemCount}`);
    } catch (error) {
      console.log('No more "Show More" button or new items to load', error);
      break;
    }
  }
};

const getData = async (url, browser) => {
  const page = await browser.newPage();
  await page.goto(url);
  await scrapeInfiniteScrollItems(page);

  const currentAuction = await page.$$eval('a.listing-card.bg-white-transparent', (auctions) => {
    return auctions.map((auction) => {
      const url = auction.href;
      return { url };
    });
  });

  auctionURLList.push(...currentAuction);

  // process the data in batches
  for (let i = 0; i < auctionURLList.length; i += batchSize) {
    const batch = auctionURLList.slice(i, i + batchSize);
    console.log(`Processing auctions ${i + 1} to ${i + batch.length} out of ${auctionURLList.length}`);

    // iterate through each auction URL and extract data
    for (const auction of batch) {
      await getDataFromPage(auction.url, browser);
    }
  }

  // console.log('All auctions passed.');
  //   console.log(currentAuctionData);

  await page.close();
  outputData();
};

const getDataFromPage = async (url, browser) => {
  const page = await browser.newPage();
  await page.goto(url);

  // extract data from the page
  try {
    const title = await page.$$eval('h1.post-title.listing-post-title', (titleElements) => {
      if (titleElements.length === 0) {
        throw new Error('Title element not found');
      }
      return titleElements[0].textContent.trim();
    });

    const titleArray = title.split(' ');

    let year;
    let make;
    let model;

    const REGEX = /[a-zA-Z]/;
    if (REGEX.test(titleArray[0])) {
      if (REGEX.test(titleArray[1])) {
        if (REGEX.test(titleArray[2])) {
          year = titleArray[3];
          make = titleArray[4];
          model = titleArray.slice(5).join(' ');
        } else {
          year = titleArray[2];
          make = titleArray[3];
          model = titleArray.slice(4).join(' ');
        }
      } else {
        year = titleArray[1];
        make = titleArray[2];
        model = titleArray.slice(3).join(' ');
      }
    } else {
      year = titleArray[0];
      make = titleArray[1];
      model = titleArray.slice(2).join(' ');
    }

    const price = await page.$eval('span.info-value.noborder-tiny > strong', (priceElement) => priceElement.textContent.trim());

    // image
    const imgSelector = 'div.listing-intro-image.column-limited-width-full-mobile > img';
    // this is to wait for the image to load using waitForFunction
    await page.waitForFunction(
      (sel) => {
        const image = document.querySelector(sel);
        return image && image.complete && image.naturalHeight !== 0;
      },
      {},
      imgSelector
    );
    // get the image URL
    const imgUrl = await page.$eval(imgSelector, (img) => img.src);

    // car specifications
    const auction_id = await page.$eval('body > main > div > div.listing-intro', (intro) => intro.getAttribute('data-listing-intro-id'));
    const lot_num = await page.$eval('body > main > div > div:nth-child(3) > div.column.column-right.column-right-force > div.essentials', (element) => {
      const lotElement = Array.from(element.querySelectorAll('div.item')).find((item) => item.textContent.includes('Lot #'));
      const match = lotElement ? lotElement.textContent.trim().match(/Lot #(\d+)/) : null;
      return match ? match[1] : '';
    });
    const chassis = await page.$eval(
      'body > main > div > div:nth-child(3) > div.column.column-right.column-right-force > div.essentials > div:nth-child(5) > ul > li:nth-child(1) > a',
      (element) => element?.textContent || ''
    );
    const seller = await page.$eval(
      'body > main > div > div:nth-child(3) > div.column.column-right.column-right-force > div.essentials > div.item.item-seller > strong + a',
      (element) => element.textContent
    );
    const location = await page.$eval('div.essentials > a[href^="https://www.google.com/maps/place/"]', (element) => element.textContent);

    // description
    const descriptionText = await page.$$('body > main > div > div:nth-child(3) > div.column.column-left > div > div.post-excerpt > p');
    const description = [];
    const images_list = [];
    let placing = 0;

    for (const element of descriptionText) {
      const excerpt = await page.evaluate((el) => el.textContent.trim(), element);

      if (excerpt !== '' && excerpt !== undefined) {
        description.push(excerpt);
      } else {
        // check if the element contains an image
        const imgElement = await element.$('img');
        if (imgElement) {
          const imgUrl = await page.evaluate((img) => img.getAttribute('src'), imgElement);
          if (imgUrl !== '' && imgUrl !== undefined) {
            placing += 1;
            const imgUrlClean = imgUrl.split('?')[0];
            images_list.push({ placing, src: imgUrlClean });
          }
        }
      }
    }

    // listing type
    const dealer = await page.$eval('body > main > div > div:nth-child(3) > div.column.column-right.column-right-force > div.essentials > div.item.additional', (element) =>
      element.textContent.trim()
    );

    let listing_type;
    if (dealer) {
      listing_type = 'Private Property';
    }

    const list = await page.$$('body > main > div > div:nth-child(3) > div.column.column-right.column-right-force > div.essentials > div:nth-child(5) > ul > li');
    const listing_details = [];

    for (const element of list) {
      const detail = await page.evaluate((el) => el.textContent.trim(), element);
      listing_details.push(detail);
    }

    const extractedData = {
      price,
      year,
      make,
      model,
      page_url: url,
      img: imgUrl,
      chassis,
      seller,
      location,
      lot_num,
      listing_type,
      auction_id,
      website: 'Bring A Trailer',
      description,
      images_list,
      listing_details,
    };

    const requiredFields = [
      'price',
      'year',
      'make',
      'model',
      'img',
      'chassis',
      'seller',
      'location',
      'lot_num',
      'listing_type',
      'auction_id',
      'description',
      'images_list',
      'listing_details',
    ];

    // check if all required fields are not null and not undefined
    const hasAllRequiredFields = requiredFields.every((field) => extractedData[field] !== null && extractedData[field] !== undefined);

    if (hasAllRequiredFields) {
      currentAuctionData.push(extractedData);
    } else {
      console.error(`Missing required fields for auction at URL: ${url}`);
    }
  } catch (error) {
    console.error(`Error processing auction at URL: ${url}`, error);
  } finally {
    await page.close();
  }
};

const outputData = async () => {
  const jsonContent = JSON.stringify(currentAuctionData);
  fs.writeFile('bringatrailer-current-data.json', jsonContent, 'utf-8', (error) => {
    if (error) {
      console.log('Error writing JSON File:', error);
    } else {
      console.log('JSON File written successfully');
    }
  });

  // Save to MongoDB
  for (const item of currentAuctionData) {
    try {
      await Auction.updateOne({ auction_id: item.auction_id }, { $set: item }, { upsert: true });
      console.log(`Processed auction with ID ${item.auction_id}`);
    } catch (error) {
      console.error(`Error processing auction with ID ${item.auction_id}: ${error}`);
    }
  }

  const preprocessedData = currentAuctionData.map((item, index) => {
    // console.log(`Processing item ${index + 1} for Excel output`); // Console log for monitoring

    // Flatten the description array into a single string if it exists
    const description = item.description ? item.description.join('; ') : '';

    // Flatten the images_list array into a single string if it exists
    const images_list = item.images_list ? item.images_list.map((img) => `${img.placing}: ${img.src}`).join('; ') : '';

    // Flatten the listing_details array into a single string if it exists
    const listing_details = item.listing_details ? item.listing_details.join('; ') : '';

    return {
      ...item,
      description,
      images_list,
      listing_details,
    };
  });

  const wb = XLSX.utils.book_new();
  const headers = [
    'price',
    'year',
    'make',
    'model',
    'page_url',
    'img',
    'chassis',
    'seller',
    'location',
    'lot_num',
    'listing_type',
    'auction_id',
    'website',
    'description',
    'images_list',
    'listing_details',
  ];
  //   const workSheet = XLSX.utils.json_to_sheet(preprocessedData, { header: headers });
  //   XLSX.utils.book_append_sheet(wb, workSheet, 'Auction Data');
  //   XLSX.writeFile(wb, 'bringatrailer_current.xlsx');
  //   console.log('XLSX file written successfully');
};

cron.schedule('47 18 * * *', async () => {
  console.log('Cron job started');
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    console.log('Starting the scraping job...');
    const page = await browser.newPage();
    await scrapeInfiniteScrollItems(page);
    await getData(website, browser);
    console.log('Scraping job finished');
  } catch (error) {
    console.error('An error occurred during the scraping job:', error);
  } finally {
    await outputData();
    await browser.close();
    await mongoose.disconnect();
    console.log('MongoDB disconnected and browser closed');
    process.exit();
  }
});
