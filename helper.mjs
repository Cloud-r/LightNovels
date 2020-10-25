import path from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import EPUB from 'epub-gen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseUrl = 'https://www.lightnovelworld.com';
let isTempDirInitialized = false;
const tempDirPath = path.resolve(__dirname, 'tmpChapters');
const tempFilePath = path.resolve(tempDirPath, 'tempChapters.txt');

let page = null;
/** Generates an instance of the page Puppeteer page */
async function getPage() {
  if (page) return page;
  const browser = await puppeteer.launch();
  page = await browser.newPage();
  return page;
}

/**
 *  Loads the Html Content for an given URL using puppeteer
 * @param {string} url - url of the page to load
 * @return {Promise<string | null>} Promise object containing the page url
 */
export async function loadPage(url) {
  console.log('Loading page for the url:', url);
  const pageUrl = `${baseUrl}${url}`;
  try {
    const page = await getPage();
    await page.goto(pageUrl, {waitUntil: 'networkidle2'});
    return await page.content();
  } catch (e) {
    console.error(`Error loading page for the url ${url}`);
    console.error(e);
    return null;
  }
}

/**
 * Gets the next chapter url and the page content
 * @param {string} pageContent the HTML content to parse through
 * @return {Array} Containing the next page url and the content
 */
export function getContentFromPage(pageContent) {
  const $ = cheerio.load(pageContent);
  const nextPageUrl = $('#input-next-chapter').val();
  const chapterName = $('.titles h2').contents()[0].data;
  const textNodes = $('.chapter-content')
      .contents()
      .filter((index, element) => element.nodeType === 3);
  let chapterContent = '';
  textNodes.each((index, element) => {
    chapterContent += element.data + '<br /><br />';
  });
  console.log(`Content process for chapter ${chapterName}`);
  return [nextPageUrl, {title: chapterName, data: chapterContent}];
}

/**
 * Generate the EPUB file from the downloaded chapters
 * @param {object} chapters Array of the chapter in the format {title, data}
 * @param {string} title Title of the book
 */
export async function generateEpub(chapters = [], title) {
  console.log(`Generating epub for ${chapters.length} chapters`);
  const outputDirPath = path.resolve(__dirname, 'output');
  fs.mkdirSync(outputDirPath, {recursive: true});
  const outputPath = `${outputDirPath}/${title}.epub`;
  const options = {
    title,
    author: 'dark',
    content: chapters,
  };
  await new EPUB(options, outputPath).promise;
}

/**
 * Writes the downloaded chapter to a temp file
 * @param {object} data downloaded chapter data
 */
export function writeToTemp(data) {
  if (!isTempDirInitialized) initializeTempDir();
  const text = JSON.stringify(data) + '||||';
  fs.appendFileSync(tempFilePath, text);
}

/** Initialize the temp dir */
export function initializeTempDir() {
  fs.mkdirSync(tempDirPath, {recursive: true});
  isTempDirInitialized = true;
}

/** MonkeyPath the loggers */
export function monkeyPatchLogger() {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => {
    originalLog(new Date().toISOString(), ...args);
  };
  console.error = (...args) => {
    originalError(new Date().toISOString(), ...args);
  };
}
