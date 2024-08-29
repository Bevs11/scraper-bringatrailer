import axios from "axios";
import * as cheerio from "cheerio";
const website = "https://www.web-scraping.dev/products";
const URL = "https://bringatrailer.com/auctions/";
import fs from "fs";

const auctionURL = [];

async function scrapeAuctions() {
  const response = await axios.get(website);

  const html = await response.data;
  const $ = cheerio.load(html);
  $(".mb-0 > a ").each((index, auction) => {
    const randomText = $(auction).attr("href");
    //   const auctionLink = $(auction).attr("href");
    // auctionURL.push("hello");
    console.log(randomText);
  });
}

// scrapeAuctions().then(() => {
//   console.log(auctionURL);
// });

async function scrapeBringATrailer() {
  try {
    const response = await axios.get(URL);
    const html = response.data;
    const $ = cheerio.load(html);
    const products = $(
      "body > main > div > div.container.container-flex > div.column.column-right.column-right-force.column-flex-right > div.essentials > div:nth-child(5) > strong"
    );
    console.log(products.text());
  } catch (error) {
    console.error("Error scraping Bring A Trailer:", error);
  }
}

scrapeBringATrailer().then((data) => {});

//minor fix

// minor fix 2
// minnor fix 3

// minnor fix 4

// async function scrapeBringATrailer() {
//   try {
//     const response = await axios.get(website);
//     const html = response.data;
//     const $ = cheerio.load(html);
//     const $products = $("div.products");
//     let extractedData = [];
//     const $items = $products.find("a");
//     console.log("length:", $items.length);

//     $items.each((index, item) => {
//       const title = $(item).text();
//       if (title) {
//         extractedData.push(title);
//       }
//     });

//     return extractedData;
//   } catch (error) {
//     console.error("Error scraping Bring A Trailer:", error);
//   }
// }

// scrapeBringATrailer().then((data) => {
//   console.log("Extracted Data:", data);
// });
