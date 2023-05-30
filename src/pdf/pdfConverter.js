const puppeteer = require("puppeteer");
const path = require("path");
const root = require("../../root");
const fs = require("fs");

//For downloading all images in a website
// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();

//   let counter = 0;
//   page.on('response', async (response) => {
//     const matches = /.*\.(jpg|png|svg|gif)$/.exec(response.url());
//     console.log(matches);
//     if (matches && (matches.length === 2)) {
//       const extension = matches[1];
//       const buffer = await response.buffer();
//       fs.writeFileSync(`src/uploads/image-${counter}.${extension}`, buffer, 'base64');
//       counter += 1;
//     }
//   });

//   await page.goto('https://www.bannerbear.com/solutions/automate-your-marketing/');

//   await browser.close();
// })();

// (async () => {

//     // Create a browser instance
//     const browser = await puppeteer.launch();

//     // Create a new page
//     const page = await browser.newPage();

//     // Website URL to export as pdf
//     const website_url = 'https://www.bannerbear.com/blog/how-to-download-images-from-a-website-using-puppeteer/';

//     // Open URL in current page
//     await page.goto(website_url, { waitUntil: 'networkidle0' });

//     //To reflect CSS used for screens instead of print
//     await page.emulateMediaType('screen');

//   // Downlaod the PDF
//     const pdf = await page.pdf({
//       path: 'result.pdf',
//       margin: { top: '100px', right: '50px', bottom: '100px', left: '50px' },
//       printBackground: true,
//       format: 'A4',
//     });

//     // Close the browser instance
//     await browser.close();
//   })();

const generatePdf = async (param) => {
  const { type, website_url, usePath, filename } = param;

  // Create a browser instance
  const browser = await puppeteer.launch({
    headless: 'new',
  });

  // Create a new page
  const page = await browser.newPage();

  if (type === "url") {
    // Web site URL to export as pdf
    //   const website_url = 'https://www.bannerbear.com/blog/how-to-download-images-from-a-website-using-puppeteer/';

    // Open URL in current page
   
    await page.goto(website_url, { waitUntil: "networkidle0" });
  } else if (type === "file") {

    //Get HTML content from HTML file
    const html = fs.readFileSync(
      path.join(root + "/templates/index.html"),
      "utf-8"
    );
    await page.setContent(html, { waitUntil: "domcontentloaded" });
  } else {
    console.log(new Error(`HTML source "${type}" is unkown.`));
    await browser.close();
    return;
  }

  // To reflect CSS used for screens instead of print
  await page.emulateMediaType("screen");

  // Downlaod the PDF
  const pdf = await page.pdf({
    // if you want to save the pdf in a file then use path
    ...(usePath && {
      path: `${path.join(root)}/templates/converted/result_${type}.pdf`,
    }),
    margin: { top: "100px", right: "50px", bottom: "100px", left: "50px" },
    printBackground: true,
    format: "A4",
  });

  // Close the browser instance
  await browser.close();
  // return {
  //   pdf,
  //   path : `${path.join(root)}/templates/converted/result_${type}.pdf`
  // }
  return pdf;
};

module.exports = generatePdf;
