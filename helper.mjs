import path from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import EPUB from 'epub-gen';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseUrl = 'https://www.lightnovelworld.com';
let isTempDirInitialized = false;
const tempDirPath = path.resolve(__dirname, 'tmpChapters');
let tempFilePath;

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
      .filter((index, element) => {
        return element.name === 'p' && !element.attribs.class;
      })
      .map((index, el) => el.children[0]);
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
  if (!isTempDirInitialized) initializeTempDir('random');
  const text = JSON.stringify(data) + '||||';
  fs.appendFileSync(tempFilePath, text);
}

/**
 * Initialize the temp dir
 * @param {string} novelName the novel name
 * @param {string} tempFileName the temp file to add content to
 *  */
export function initializeTempDir(novelName, tempFileName) {
  const fileName = tempFileName || `${novelName}_${new Date().getTime()}.txt`;
  fs.mkdirSync(tempDirPath, {recursive: true});
  tempFilePath = path.resolve(tempDirPath, fileName);
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

/**
 * @return {Promise<object>} novel url and novel name
 */
export async function getNovelInfo() {
  const newString = 'New Novel';
  const retryString = 'Retry Old Download';
  const questions = [
    {
      type: 'list',
      name: 'mode',
      message: 'Select The Mode',
      choices: [newString, retryString],
    },
    {
      type: 'input',
      name: 'novelName',
      message: 'Novel Name',
    },
    {
      type: 'input',
      name: 'chapterURL',
      message: 'First Chapter URL',
      when: (answers) => {
        return answers.mode === newString;
      },
    },
    {
      type: 'input',
      name: 'tempFileName',
      message: 'Temp File to use to rebuild data',
      when: (answers) => {
        return answers.mode === retryString;
      },
    },
    {
      type: 'input',
      name: 'retryChapterURL',
      message: 'URL of the next chapter to download',
      when: (answers) => {
        return answers.mode === retryString;
      },
    },
  ];
  const {novelName, chapterURL, mode, tempFileName, retryChapterURL} =
   await inquirer.prompt(questions);
  const isNewDownload = mode === newString;
  return {novelName, chapterURL, isNewDownload, tempFileName, retryChapterURL};
}

/**
 * @param {string} tempFileName the file to rebuild from
 * @return {Array} rebuilt files array
 */
export function rebuildChapterArray(tempFileName) {
  console.info('Rebuilding Files');
  const filePath = path.resolve(tempDirPath, tempFileName);
  const fileContent = fs.readFileSync(filePath, {encoding: 'utf8'});
  const fileArray = fileContent.split('||||')
      .map((content) => {
        return JSON.parse(content);
      });
  console.info('Files rebuild successfully');
  return fileArray;
}
