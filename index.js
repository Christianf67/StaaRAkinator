const puppeteer = require('puppeteer');
const fs = require('fs');
const folderPath = 'trouve';
const personnage = 'StaaR';
const description = 'Streameuse';
const { connect } = require('mongoose');
const nombres = require('./modals/nombres')
require('dotenv').config();
const { token, databaseToken } = process.env;

(async() => {
  await connect(databaseToken).catch(console.error) 
})();

function getReponseByQuestion(questionARechercher) {
  try {
    const data = fs.readFileSync('questions.json', 'utf8');
    const jsonData = JSON.parse(data);
    const elementFound = jsonData.find((element) => element.question === questionARechercher);

    return elementFound ? elementFound.reponse : null;
  } catch (error) {
    console.error('Erreur lors de la lecture ou du parsing du fichier JSON :', error);
    return null;
  }
}

function extraireNombre(phrase) {
  const match = phrase.match(/\b(\d+)\b/);

  if (match) {
      const nombre = match[1];
      return nombre;
  } else {
      return null;
  }
}

async function saveScreenshot(screenshotBuffer) {
  const fileName = `${await getNextScreenshotNumber()}.png`;
  const filePath = `${folderPath}/${fileName}`;

  if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
  }

  fs.writeFileSync(filePath, screenshotBuffer);
}

async function getNextScreenshotNumber() {
  if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
  }

  const files = fs.readdirSync(folderPath);

  return files.length + 1;
}

(async () => {
  // Page d'accueil
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://fr.akinator.com/');

  await page.setViewport({width: 1266, height: 913});

  await page.waitForTimeout(5000);

  await page.mouse.click(1140, 842);

  // Choix du thème

  page.goto('https://fr.akinator.com/theme-selection')

  await page.waitForTimeout(2000);

  page.mouse.click(595, 484);

  // Jeu

  while(true){
  
  await page.waitForTimeout(5000);

  const bubbleContainer = await page.$('.bubble-propose-container');

  if (bubbleContainer) {
    const content = await page.$eval('span.proposal-title', (spanElement) => {
      return spanElement.textContent;
    });

    if(`${content}` === `Un souci technique s'est produit. Merci de réessayer.`){
      await page.waitForSelector('#a_replay');

      await page.click('#a_replay');
      await page.waitForTimeout(5000);
    }else{

    const content2 = await page.$eval('span.proposal-subtitle', (spanElement) => {
      return spanElement.textContent;
    });

    if(`${content}` === `${personnage}` && `${content2}` ===  `${description}`){
      await page.waitForSelector('#a_propose_yes');

      await page.click('#a_propose_yes');
      await page.waitForTimeout(5000);
      const screenshot = await page.screenshot()

      const content3 = await page.$eval('span.win-subtitle.last-played', (spanElement) => {
        return spanElement.textContent;
      });

      const nombre = await extraireNombre(content3)
      
      const bot = await getNextScreenshotNumber();

      await nombres.updateOne({}, { $set: {total: nombre, bot: bot}})

      await saveScreenshot(screenshot);

      await page.waitForSelector('#a_replay');
      await page.click('#a_replay');
    }else{
      await page.waitForSelector('#a_propose_no');

      await page.click('#a_propose_no');
      await page.waitForTimeout(500);

      const divFormulaire = await page.$('.aki-formulaire.dialog-box');

  if (divFormulaire) {
    try {
      const inputSelector = '.aki-formulaire.dialog-box form p.input-diamond label input[type="text"][name="name"]';

      await page.waitForSelector(inputSelector);

      await page.type(inputSelector, `${personnage}`);
      await page.waitForSelector('#input-soundlike-search');
      await page.click('#input-soundlike-search');
      await page.waitForTimeout(3000);
  
      const links = await page.$$('a');
  
      for (const link of links) {
        const linkText = await page.evaluate((el) => el.textContent, link);
  
        if (linkText.includes(`${personnage} (${description})`)) {
          await link.click();
          await page.waitForTimeout(2000);
          await page.waitForSelector('#a_replay');
          await page.click('#a_replay');
          break;
        }
      }
} catch (error) {
  console.error('Une erreur s\'est produite : ', error);
}
  }else{
      await page.waitForSelector('#a_continue_yes');

      await page.click('#a_continue_yes');
  }
}
    }
  } else {
  const content = await page.$eval('p.question-text', (pElement) => {
    return pElement.textContent;
  });

  const reponse = await getReponseByQuestion(content)
  if(reponse !== null){
    await page.waitForSelector(`#a_${reponse}`);

    await page.click(`#a_${reponse}`);
  }else{
    console.log(`La question "${content}" n'est pas dans le fichier questions.json !`)
    await page.waitForSelector('#a_dont_know');

    await page.click('#a_dont_know');
  }
}
  }
  await browser.close();
})();