'use strict';

const express = require('express');
const puppeteer = require('puppeteer');
const chalk = require('chalk');
const validUrl = require('valid-url');
const bodyParser = require('body-parser');

require('dotenv').config();

const PORT = 8080;
const HOST = '0.0.0.0';

const app = express();

var jsonParser = bodyParser.json();

app.post('/', jsonParser, async (req, res) => {
	try {
		var apiKey = req.headers['x-api-key'];

		if (apiKey !== process.env.X_API_Key) {
			console.log(chalk.yellow.bold('Invalid apiKey!'));
			return res.status(403).json({ errorMessage: 'Unathorized access!' }).send();
		}

		if (!validUrl.isUri(req.body.url)) {
			console.log(chalk.yellow.bold('Invalid url!'));
			return res.status(400).json({ errorMessage: 'Invalid url!' }).send();
		}

		if (!req.body.referenceLogId) {
			console.log(chalk.yellow.bold('ReferenceLogId parameter not passed!'));
			return res.status(400).json({ errorMessage: 'Empty referenceLogId parameter!' }).send();
		}

		console.log(chalk.blue('Request started for ' + req.body.referenceLogId));

		const argv = process.execArgv.join();
		const isDebug = argv.includes('inspect') || argv.includes('debug');

		var launchOptions = {
			headless: true,
			args: ['--no-sandbox']
		};

		//This is needed for the Docker container
		if (!isDebug) {
			launchOptions.executablePath = '/usr/bin/google-chrome';
		}

		const browser = await puppeteer.launch(launchOptions);
		const page = await browser.newPage();

		await page.goto(req.body.url, {
			waitUntil: 'networkidle2'
		});

		let height = await page.evaluate(() => document.documentElement.offsetHeight);
		let width = await page.evaluate(() => document.documentElement.offsetWidth);

		if (!req.body.pdfOptions) {
			req.body.pdfOptions = {};
		}

		const pdfOptions = {
			landscape: req.body.pdfOptions.landscape || true,
			format: req.body.pdfOptions.format || 'A4',
			printBackground: req.body.pdfOptions.printBackground || true,
			displayHeaderFooter: req.body.pdfOptions.displayHeaderFooter || true,
			width: req.body.pdfOptions.width || width + 'px',
			height: req.body.pdfOptions.height || height + 'px',
		};

		// await page.emulateMediaType("print");

		const pdf = await page.pdf(pdfOptions);

		await browser.close();

		res.contentType('application/pdf');
		res.status(200).send(pdf);

		console.log(chalk.bold.bgGreen('Request ' + req.body.referenceLogId + ' finished successfully.'));
	} catch (error) {
		console.log(chalk.bold.bgRed('Request ' + req.body.referenceLogId + '. Error: ' + error.message));
		return res.status(500).json({ errorMessage: error });
	} finally {
		console.log(chalk.blue('Request ' + req.body.referenceLogId + ' exited.'));
	}
});

app.listen(PORT, HOST);

console.log(`Running on http://${HOST}:${PORT}`);