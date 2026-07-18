/* Built National Parks Explorer integration: file://, generated CSP, deep links, and 29 endpoints. */
import {chromium} from "playwright";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {routeNps} from "./interactions/parks.mjs";
const ROOT=resolve(import.meta.dirname,"..");
const KEY="TEST-NPS-KEY-NOT-REAL-0000000000000000";
let browser;try{browser=await chromium.launch({channel:"chrome"})}catch(e){if(!String(e).includes("distribution 'chrome' is not found"))throw e;browser=await chromium.launch()}
const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage();
const issues=[];page.on("console",m=>{if(m.type()==="error")issues.push(m.text())});page.on("pageerror",e=>issues.push(String(e)));
const track={requests:0,paths:new Set(),headers:[],queryLeak:false,galleryAssetQuery:null,unsafeFiltered:false};await routeNps(page,track);
await page.addInitScript(k=>{localStorage.setItem("suite.key.nps",k);localStorage.setItem("suite.parks.active","yell")},KEY);
await page.goto(pathToFileURL(resolve(ROOT,"dist","parks.html")).href+"?park=yell&tab=reference");
await page.waitForSelector('.park-hero h2:has-text("Yellowstone")');
async function settled(){await page.waitForFunction(()=>{const xs=[...document.querySelectorAll('.resource-status')];return xs.length&&xs.every(x=>!x.classList.contains('loading-dot'))},{timeout:30000})}
await settled();let galleryPickerOptions=0;
for(const tab of ["alerts","visit","explore","learn","media","reference"]){await page.click(`.tab[data-tab="${tab}"]`);await settled();if(tab==="visit"){const buttons=page.locator('button[data-load-resource]');for(let i=(await buttons.count())-1;i>=0;i--)await buttons.nth(i).click();await settled()}if(tab==="media")galleryPickerOptions=await page.locator('select[aria-label="Choose a gallery for assets"] option').count()}
await page.click('.tab[data-tab="reference"]');await settled();
const result=await page.evaluate(key=>({title:document.title,park:document.querySelector('.park-hero h2')?.textContent,healthRows:document.querySelectorAll('.health-row').length,healthOk:document.querySelectorAll('.health-state.ok').length,cspAllowsApi:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content.includes('https://developer.nps.gov'),cspAllowsImages:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content.includes('https://www.nps.gov'),keyVisible:document.body.innerText.includes(key),horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}),KEY);
Object.assign(result,{galleryPickerOptions,endpointCount:track.paths.size,allHeaderAuth:track.headers.every(v=>v===KEY),queryLeak:track.queryLeak,galleryScoped:track.galleryAssetQuery?.galleryId==="G1"&&track.galleryAssetQuery?.parkCode===null,consoleIssues:issues});
console.log(JSON.stringify(result,null,2));
await browser.close();
if(result.park!=="Yellowstone National Park"||result.healthRows!==29||result.healthOk!==29||result.galleryPickerOptions!==2||result.endpointCount!==29||!result.allHeaderAuth||result.queryLeak||!result.galleryScoped||!result.cspAllowsApi||!result.cspAllowsImages||result.keyVisible||result.horizontalOverflow||issues.length)process.exit(1);
