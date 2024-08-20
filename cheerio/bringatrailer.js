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
  const response = await axios.get(URL);
  const html = await response.data;
  const $ = cheerio.load(html);
  const container = $("div.listings-container");
  container
    .find("a.listing-card.bg-white-transparent > h3")
    .each((index, auction) => {
      const randomText = $(auction).text();
      //   const auctionLink = $(auction).attr("href");
      // auctionURL.push("hello");
      console.log(randomText);
    });
}

scrapeBringATrailer().then(() => {
  //   console.log(auctionURL);
});
