const fs = require('fs');
const puppeteer = require('puppeteer');
const {GoogleSpreadsheet} = require('google-spreadsheet');
const credentials = require('./credentials.json');
const schedule = require('node-schedule');
//const sheet = require('./sheet');



function extractItems () {
	return Array.from(document.querySelectorAll('#loader .item'), element => {
		const platform = element.querySelector('.anbieter-logo')
		const header = element.querySelector('#badges .green')
		const business = element.querySelector('#badges .orange')
		const privat = element.querySelector('#badges .blue')
		const alert = element.querySelector('#badges .red')
		const gebraucht = element.querySelector('.attribute-container>div:nth-child(4)')
		const color = element.querySelector('.rounded-full')
		const model = element.querySelector('h4')
		const fuel_type = element.querySelector('[src*=fuel] + .attribute-text')
		const gear_type = element.querySelector('[src*=transmission] + .attribute-text')
		const ps_kw = element.querySelector('#top-card > div.column.is-5 > div > div > div:nth-child(3) > div > div > p:nth-child(2)') //('.attribute-container>div:nth-child(3)')
		const consumption = element.querySelector('.emissions')
		const leasing_factor = element.querySelector('.price-container .left .top')
		const rate = element.querySelector('.price-container .right .top')
		const netto_brutto = element.querySelector('.price-container .right .bottom')
	 	const qltr = element.querySelector('.laufzeit')
		const note = element.querySelector('#price-column > div.pricetag-badge.anzahlung > span')
		const url = element.querySelector('.item .dropdown-item > span')

		return {
			platform:       platform ? platform.src.replace(/.*\/(\w+)%.*/, '$1') : '-',
			header:         header ? header.innerText : '-',
			business: 		business ? (business.innerText) : '-', //=== 'GEWERBE' ? 'B2B' : 'B2C') : '-',
			privat:			privat ? (privat.innerText) : '-', 
			gebraucht:      gebraucht ? gebraucht.innerText : '-',
			alert : 		alert ? (alert.innerText) : '-',
			color:          color ? color.innerText : '-',
			model:          model ? model.innerText : '-',
			fuel_type:      fuel_type ? fuel_type.innerText : '-',
			gear_type:      gear_type ? gear_type.innerText : '-',
		//	ps:             ps_kw ? ps_kw.innerText.match(/\d+/g)[0] : '-', // ps_kw ? ps_kw.innerText.match(/\d+/g)[0] : '-',
		//	kw:             ps_kw ? ps_kw.innerText.match(/\d+/g)[1] : '-',
			consumption:    consumption ? consumption.innerText : '-',
			leasing_factor: leasing_factor ? leasing_factor.innerText.replace('.', '').replace(',', '.').replace(/\D*([\d\.]+).*/, '$1') : '-',
			rate:           rate ? (rate.innerText.replace('.', '').replace(',', '.').replace(/\D*([\d\.]+).*/, '$1')+ ' €') : '-',
			netto_brutto:   netto_brutto ? (netto_brutto.innerText.match(/brutto/i) ? 'brutto' : 'netto') : '-',
			duration:       qltr ? qltr.innerText.split('/').map(el => el.replace(/\D*(\d+).*/, '$1'))[0]*1000 : '-',
			mileage:        qltr ? qltr.innerText.split('/').map(el => el.replace(/\D*(\d+).*/, '$1'))[1]: '-',
			note: 			note ? note.innerText : '-',
			url:      		url ? "https://www.goleasy.de/forward?ref="+url.outerHTML.substring(url.outerHTML.indexOf("ref%3D")+3,url.outerHTML.indexOf("%26source")) :'-'
		}
	})
};

function convertDataArrayToCSV (fileName, data) {

	const header = Object.keys(data[0])
	let csv = data.map(row => header
		.map(fieldName => row[fieldName] === null ? '' : row[fieldName])
		.join(';'))
	csv.unshift(header.join(';'))
	csv = csv.join('\r\n')
	fs.writeFileSync(fileName, csv)	

}  
async function scrapeInfiniteScrollItems (
page,
extractItems,
itemTargetCount,
scrollDelay = 2000
) {
let items = []
try {
	let previousHeight
	while (items.length < itemTargetCount) {
		items = await page.evaluate(extractItems)
		previousHeight = await page.evaluate('document.body.scrollHeight')
		await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
		await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`)
		await wait(scrollDelay)
	}
} catch(e) {
	throw e
}
return items
}

async function wait (ms) {
new Promise((resolve) => setTimeout(resolve, ms))
};

// Schedule a trigger

//const job = schedule.scheduleJob('42 * * * *',function())

(async () => {
// Set up browser and page.
const browser = await puppeteer.launch({
	headless: false,
	args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
page.setViewport({ width: 1280, height: 926 })
// https://www.goleasy.de/inserate?sort=neuste&preisanzeige=netto
// Navigate to the demo page.
await page.goto('https://www.goleasy.de/inserate?sort=neuste&preisanzeige=netto')
// Scroll and extract items from the page.
const items = await scrapeInfiniteScrollItems(page, extractItems, 10 ) // item target count 
// Convert extracted items to cs
convertDataArrayToCSV ('./data.csv', items)
// Write to sheet
AccessSpreadsheet(items)
// Save extracted items to a file.
// --------------- fs.writeFileSync('./items.txt',items.join('\n')+'\n') //.replace(/\n/g, '') --
// Close the browser.
await browser.close()
})()


async function AccessSpreadsheet(meta) {
	const spreadsheetId = '1Awyak298CPEVtC-EnHBYvPgy54lqxWSMOgAXY9SXKXQ'
	const doc = new GoogleSpreadsheet(spreadsheetId); // set spreadsheet id
	await doc.useServiceAccountAuth(credentials);
	await doc.loadInfo();
	const oldSheet = await doc.sheetsByTitle['GoLeasy']
	await oldSheet.delete()
	const sheet = await doc.addSheet({ 
		 title: 'GoLeasy' ,
		 headerValues: [
			"platform",
			"header",
			"business", 		
			"privat",		
			"alert", 
			"gebraucht",	
			"model",        
			"fuel_type",      
			"gear_type",
			"duration",
			"mileage",
			"leasing_factor", 
			"rate",
			"netto_brutto",    
			"color",  
			"ps",                      
			"consumption",   
			"note",
			"url"
		]})

	await sheet.addRows(meta)
	}; 	
